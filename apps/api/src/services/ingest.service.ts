import {
  steamId64FromProfile,
  type MatchMetadataResponse,
  type PlayerMatchHistoryEntry,
} from "@deadlock/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { toInt } from "../utils/number.js";
import { deadlockClient } from "./deadlock-client.js";
import { resolvePatchIdForUnixSeconds } from "./patch.service.js";

export interface IngestSummary {
  processedMatchIds: number[];
  newMatchesFetched: number;
  existingMatchesSkipped: number;
}

export interface RegisterProfileInput {
  accountId: number;
  personaName?: string;
  avatarUrl?: string;
  steamId64?: string;
  enrichFromSteam?: boolean;
}

export async function registerProfile(
  input: RegisterProfileInput,
): Promise<{
  accountId: number;
  personaName: string | null;
  avatarUrl: string | null;
  steamId64: string | null;
}> {
  let personaName = input.personaName;
  let avatarUrl = input.avatarUrl;
  let steamId64 = input.steamId64;

  if (input.enrichFromSteam ?? true) {
    const profile = await deadlockClient
      .getSteamProfile({ account_id: input.accountId })
      .catch(() => []);
    const playerProfile = profile?.[0];
    personaName =
      personaName ?? (playerProfile?.personaname as string | undefined);
    avatarUrl = avatarUrl ?? (playerProfile?.avatarfull as string | undefined);
    steamId64 =
      steamId64 ??
      (playerProfile ? (steamId64FromProfile(playerProfile) ?? undefined) : undefined);
  }

  const player = await prisma.player.upsert({
    where: { accountId: input.accountId },
    update: {
      steamId64: steamId64 ?? undefined,
      personaName: personaName ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    },
    create: {
      accountId: input.accountId,
      steamId64: steamId64 ?? undefined,
      personaName: personaName ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    },
  });

  return {
    accountId: player.accountId,
    personaName: player.personaName ?? null,
    avatarUrl: player.avatarUrl ?? null,
    steamId64: player.steamId64 ?? null,
  };
}

export async function ingestFromAccount(
  accountId: number,
): Promise<IngestSummary> {
  await registerProfile({ accountId, enrichFromSteam: true });

  const history: PlayerMatchHistoryEntry[] =
    await deadlockClient.getPlayerMatchHistory(accountId);
  const matchIds = [...new Set(history.map((entry) => entry.match_id))];
  const ingestSummary = await ingestFromMatchIds(matchIds);

  for (const entry of history) {
    await upsertFromHistoryEntry(entry);
  }

  await prisma.player.update({
    where: { accountId },
    data: { lastRefreshedAt: new Date() },
  });

  return ingestSummary;
}

export async function ingestFromMatchIds(
  matchIds: number[],
): Promise<IngestSummary> {
  const uniqueIds = [
    ...new Set(matchIds.filter((matchId) => Number.isFinite(matchId))),
  ];
  if (uniqueIds.length === 0) {
    return {
      processedMatchIds: [],
      newMatchesFetched: 0,
      existingMatchesSkipped: 0,
    };
  }

  const existing = await prisma.match.findMany({
    where: {
      matchId: {
        in: uniqueIds.map((matchId) => BigInt(matchId)),
      },
    },
    select: {
      matchId: true,
    },
  });

  const existingSet = new Set(existing.map((entry) => Number(entry.matchId)));
  const toFetch = uniqueIds.filter((id) => !existingSet.has(id));

  for (const matchId of toFetch) {
    const metadata = await deadlockClient.getMatchMetadata(matchId);
    await upsertFromMetadata(matchId, metadata);
  }

  return {
    processedMatchIds: uniqueIds,
    newMatchesFetched: toFetch.length,
    existingMatchesSkipped: uniqueIds.length - toFetch.length,
  };
}

export async function upsertFromHistoryEntry(entry: PlayerMatchHistoryEntry) {
  const patchId = await resolvePatchIdForUnixSeconds(entry.start_time);
  const accountId = entry.account_id;

  await registerProfile({ accountId, enrichFromSteam: false });

  await prisma.match.upsert({
    where: {
      matchId: BigInt(entry.match_id),
    },
    update: {
      startTime: new Date(entry.start_time * 1000),
      patchId: patchId ?? undefined,
      gameMode: entry.game_mode,
      matchMode: entry.match_mode,
      durationSec: entry.match_duration_s,
    },
    create: {
      matchId: BigInt(entry.match_id),
      startTime: new Date(entry.start_time * 1000),
      patchId: patchId ?? undefined,
      gameMode: entry.game_mode,
      matchMode: entry.match_mode,
      durationSec: entry.match_duration_s,
    },
  });

  const kda = computeKda(
    entry.player_kills,
    entry.player_deaths,
    entry.player_assists,
  );

  await prisma.matchPlayer.upsert({
    where: {
      matchId_accountId: {
        matchId: BigInt(entry.match_id),
        accountId,
      },
    },
    update: {
      heroId: entry.hero_id,
      heroLevel: entry.hero_level,
      playerTeam: entry.player_team,
      kills: entry.player_kills,
      deaths: entry.player_deaths,
      assists: entry.player_assists,
      lastHits: entry.last_hits,
      denies: entry.denies,
      netWorth: entry.net_worth,
      soulsPerMinute: entry.match_duration_s
        ? Number((entry.net_worth / (entry.match_duration_s / 60)).toFixed(2))
        : null,
      win: entry.match_result === 1,
      extraMetrics: {
        objectivesMaskTeam0: entry.objectives_mask_team0,
        objectivesMaskTeam1: entry.objectives_mask_team1,
        kda,
      },
    },
    create: {
      matchId: BigInt(entry.match_id),
      accountId,
      heroId: entry.hero_id,
      heroLevel: entry.hero_level,
      playerTeam: entry.player_team,
      kills: entry.player_kills,
      deaths: entry.player_deaths,
      assists: entry.player_assists,
      lastHits: entry.last_hits,
      denies: entry.denies,
      netWorth: entry.net_worth,
      soulsPerMinute: entry.match_duration_s
        ? Number((entry.net_worth / (entry.match_duration_s / 60)).toFixed(2))
        : null,
      win: entry.match_result === 1,
      extraMetrics: {
        objectivesMaskTeam0: entry.objectives_mask_team0,
        objectivesMaskTeam1: entry.objectives_mask_team1,
        kda,
      },
    },
  });
}

async function upsertFromMetadata(
  matchId: number,
  metadata: MatchMetadataResponse,
) {
  const matchStartUnix =
    toInt(metadata.start_time) ??
    toInt(
      (metadata.match as Record<string, unknown> | undefined)?.start_time,
    ) ??
    toInt(
      (metadata.match_info as Record<string, unknown> | undefined)?.start_time,
    ) ??
    Math.floor(Date.now() / 1000);
  const patchId = await resolvePatchIdForUnixSeconds(matchStartUnix);

  await prisma.match.upsert({
    where: {
      matchId: BigInt(matchId),
    },
    update: {
      startTime: new Date(matchStartUnix * 1000),
      patchId: patchId ?? undefined,
      gameMode:
        toInt(metadata.game_mode) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.game_mode,
        ),
      matchMode:
        toInt(metadata.match_mode) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.match_mode,
        ),
      durationSec:
        toInt(metadata.duration_s) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.duration_s,
        ),
      rawMetadata: metadata as Prisma.InputJsonValue,
    },
    create: {
      matchId: BigInt(matchId),
      startTime: new Date(matchStartUnix * 1000),
      patchId: patchId ?? undefined,
      gameMode:
        toInt(metadata.game_mode) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.game_mode,
        ),
      matchMode:
        toInt(metadata.match_mode) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.match_mode,
        ),
      durationSec:
        toInt(metadata.duration_s) ??
        toInt(
          (metadata.match as Record<string, unknown> | undefined)?.duration_s,
        ),
      rawMetadata: metadata as Prisma.InputJsonValue,
    },
  });

  const players = extractMetadataPlayers(metadata);
  for (const player of players) {
    if (!player.accountId) {
      continue;
    }

    await registerProfile({
      accountId: player.accountId,
      enrichFromSteam: false,
    });

    await prisma.matchPlayer.upsert({
      where: {
        matchId_accountId: {
          matchId: BigInt(matchId),
          accountId: player.accountId,
        },
      },
      update: {
        heroId: player.heroId ?? undefined,
        heroLevel: player.heroLevel ?? undefined,
        playerTeam: player.playerTeam ?? undefined,
        kills: player.kills ?? undefined,
        deaths: player.deaths ?? undefined,
        assists: player.assists ?? undefined,
        lastHits: player.lastHits ?? undefined,
        denies: player.denies ?? undefined,
        netWorth: player.netWorth ?? undefined,
        damageDealt: player.damageDealt ?? undefined,
        damageTaken: player.damageTaken ?? undefined,
        objectiveDamage: player.objectiveDamage ?? undefined,
        bossDamage: player.bossDamage ?? undefined,
        healingDone: player.healingDone ?? undefined,
        rankTier: player.rankTier ?? undefined,
        rankDivision: player.rankDivision ?? undefined,
        rankSubrank: player.rankSubrank ?? undefined,
        itemBuild: asJson(player.itemBuild),
        abilityBuild: asJson(player.abilityBuild),
        progressionCurve: asJson(player.progressionCurve),
        extraMetrics: asJson(player.extraMetrics),
        win: player.win ?? undefined,
      },
      create: {
        matchId: BigInt(matchId),
        accountId: player.accountId,
        heroId: player.heroId ?? undefined,
        heroLevel: player.heroLevel ?? undefined,
        playerTeam: player.playerTeam ?? undefined,
        kills: player.kills ?? undefined,
        deaths: player.deaths ?? undefined,
        assists: player.assists ?? undefined,
        lastHits: player.lastHits ?? undefined,
        denies: player.denies ?? undefined,
        netWorth: player.netWorth ?? undefined,
        damageDealt: player.damageDealt ?? undefined,
        damageTaken: player.damageTaken ?? undefined,
        objectiveDamage: player.objectiveDamage ?? undefined,
        bossDamage: player.bossDamage ?? undefined,
        healingDone: player.healingDone ?? undefined,
        rankTier: player.rankTier ?? undefined,
        rankDivision: player.rankDivision ?? undefined,
        rankSubrank: player.rankSubrank ?? undefined,
        itemBuild: asJson(player.itemBuild),
        abilityBuild: asJson(player.abilityBuild),
        progressionCurve: asJson(player.progressionCurve),
        extraMetrics: asJson(player.extraMetrics),
        win: player.win ?? undefined,
      },
    });
  }
}

interface MetadataPlayerExtract {
  accountId: number | null;
  heroId: number | null;
  heroLevel: number | null;
  playerTeam: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  lastHits: number | null;
  denies: number | null;
  netWorth: number | null;
  damageDealt: number | null;
  damageTaken: number | null;
  objectiveDamage: number | null;
  bossDamage: number | null;
  healingDone: number | null;
  rankTier: string | null;
  rankDivision: number | null;
  rankSubrank: number | null;
  itemBuild: unknown;
  abilityBuild: unknown;
  progressionCurve: unknown;
  extraMetrics: Record<string, unknown>;
  win: boolean | null;
}

function extractMetadataPlayers(
  metadata: MatchMetadataResponse,
): MetadataPlayerExtract[] {
  const rawCandidates =
    pickArray(metadata.players) ??
    pickArray(
      (metadata.match as Record<string, unknown> | undefined)?.players,
    ) ??
    pickArray(
      (metadata.match_info as Record<string, unknown> | undefined)?.players,
    ) ??
    pickArray(
      (metadata["player_stats"] as Record<string, unknown> | undefined)
        ?.players,
    ) ??
    [];

  return rawCandidates
    .map((raw) => {
      const player = raw as Record<string, unknown>;
      const accountId =
        toInt(player.account_id) ??
        toInt(player.accountId) ??
        toInt(player.player_id) ??
        toInt(player.steamid3) ??
        null;

      const kills = toInt(player.kills) ?? toInt(player.player_kills) ?? null;
      const deaths =
        toInt(player.deaths) ?? toInt(player.player_deaths) ?? null;
      const assists =
        toInt(player.assists) ?? toInt(player.player_assists) ?? null;

      return {
        accountId,
        heroId: toInt(player.hero_id) ?? toInt(player.heroId) ?? null,
        heroLevel: toInt(player.hero_level) ?? null,
        playerTeam: toInt(player.player_team) ?? toInt(player.team) ?? null,
        kills,
        deaths,
        assists,
        lastHits: toInt(player.last_hits) ?? toInt(player.creep_kills) ?? null,
        denies: toInt(player.denies) ?? null,
        netWorth: toInt(player.net_worth) ?? toInt(player.souls) ?? null,
        damageDealt:
          toInt(player.hero_damage) ??
          toInt(player.damage_dealt) ??
          toInt(player.player_damage) ??
          null,
        damageTaken: toInt(player.damage_taken) ?? null,
        objectiveDamage: toInt(player.objective_damage) ?? null,
        bossDamage: toInt(player.boss_damage) ?? null,
        healingDone: toInt(player.healing_done) ?? null,
        rankTier:
          typeof player.rank_tier === "string"
            ? player.rank_tier
            : typeof player.rankTier === "string"
              ? player.rankTier
              : null,
        rankDivision: toInt(player.rank_division) ?? null,
        rankSubrank: toInt(player.rank_subrank) ?? null,
        itemBuild: player.items ?? player.item_build ?? null,
        abilityBuild: player.ability_upgrades ?? player.ability_build ?? null,
        progressionCurve: player.curves ?? player.progression ?? null,
        extraMetrics: {
          kda:
            kills !== null && deaths !== null && assists !== null
              ? computeKda(kills, deaths, assists)
              : null,
          lane: player.lane ?? null,
        },
        win:
          typeof player.won === "boolean"
            ? player.won
            : typeof player.win === "boolean"
              ? player.win
              : null,
      };
    })
    .filter((entry) => entry.accountId !== null);
}

function computeKda(kills: number, deaths: number, assists: number) {
  if (deaths === 0) {
    return kills + assists;
  }
  return Number(((kills + assists) / deaths).toFixed(2));
}

function pickArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export async function ingestManualInput(input: {
  matchIds?: number[];
  accountId?: number;
  steamId?: string;
}) {
  if (input.steamId) {
    const profile = await deadlockClient.getSteamProfile({
      steam_id: input.steamId,
    });
    const resolvedAccountId = profile?.[0]?.account_id;
    if (!resolvedAccountId) {
      throw new Error(`Could not resolve Steam profile ${input.steamId}.`);
    }
    return ingestFromAccount(resolvedAccountId);
  }

  if (input.accountId) {
    return ingestFromAccount(input.accountId);
  }

  if (input.matchIds && input.matchIds.length > 0) {
    return ingestFromMatchIds(input.matchIds);
  }

  throw new Error("No valid manual ingest input provided.");
}
