import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PlayerPerformanceCurvePoint } from "@deadlock/shared";
import { prisma } from "../lib/prisma.js";
import { getHeroMap } from "./asset-cache.service.js";
import { deadlockClient } from "./deadlock-client.js";

export interface StatsFilter {
  lastGames?: number;
  patchId?: string;
  heroId?: number;
}

export async function getPlayerStats(accountId: number, filter: StatsFilter) {
  const allRows = await prisma.matchPlayer.findMany({
    where: {
      accountId,
    },
    include: {
      match: {
        include: {
          players: {
            select: {
              accountId: true,
              playerTeam: true,
              rankTier: true,
              rankDivision: true,
              rankSubrank: true,
            },
          },
        },
      },
    },
    orderBy: {
      match: {
        startTime: "desc",
      },
    },
  });

  const filteredRows = allRows.filter((row) => {
    const patchOk = filter.patchId
      ? row.match.patchId === filter.patchId
      : true;
    const heroOk = filter.heroId ? row.heroId === filter.heroId : true;
    return patchOk && heroOk;
  });

  const slicedRows =
    filter.lastGames && filter.lastGames > 0
      ? filteredRows.slice(0, filter.lastGames)
      : filteredRows;
  const heroMap = await getHeroMap();
  const trackerRating = computeTrackerRating(accountId, allRows);
  const trackerByMatch = new Map(
    trackerRating.timeline.map((entry) => [entry.matchId, entry]),
  );

  const matches = slicedRows.map((row) => ({
    matchId: row.matchId.toString(),
    startTime: row.match.startTime.toISOString(),
    patchId: row.match.patchId,
    heroId: row.heroId,
    heroName: row.heroId ? (heroMap.get(row.heroId)?.name ?? null) : null,
    heroIcon: row.heroId ? (heroMap.get(row.heroId)?.iconUrl ?? null) : null,
    durationSec: row.match.durationSec,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    netWorth: row.netWorth,
    lastHits: row.lastHits,
    denies: row.denies,
    damageDealt: row.damageDealt,
    damageTaken: row.damageTaken,
    objectiveDamage: row.objectiveDamage,
    healingDone: row.healingDone,
    win: row.win,
    queueCategory:
      trackerByMatch.get(row.matchId.toString())?.queueCategory ?? "unknown",
    queueWeight: trackerByMatch.get(row.matchId.toString())?.queueWeight ?? 1,
    trackerBefore:
      trackerByMatch.get(row.matchId.toString())?.trackerBefore ?? null,
    trackerDelta:
      trackerByMatch.get(row.matchId.toString())?.trackerDelta ?? null,
    trackerAfter:
      trackerByMatch.get(row.matchId.toString())?.trackerAfter ?? null,
    matchAvgRank:
      trackerByMatch.get(row.matchId.toString())?.matchAvgRank ?? null,
    itemBuild: row.itemBuild,
    abilityBuild: row.abilityBuild,
    progressionCurve: row.progressionCurve,
  }));

  const totalMatches = slicedRows.length;
  const wins = slicedRows.filter((row) => row.win).length;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;

  const avgKda = average(
    slicedRows.map((row) => {
      const kills = row.kills ?? 0;
      const assists = row.assists ?? 0;
      const deaths = row.deaths ?? 0;
      return deaths === 0 ? kills + assists : (kills + assists) / deaths;
    }),
  );
  const avgNetWorth = average(slicedRows.map((row) => row.netWorth ?? 0));
  const avgCs = average(
    slicedRows.map((row) => (row.lastHits ?? 0) + (row.denies ?? 0)),
  );

  const recentForm = slicedRows.slice(0, 10).map((row) => ({
    matchId: row.matchId.toString(),
    win: row.win ?? false,
    heroId: row.heroId,
    kda: ratio((row.kills ?? 0) + (row.assists ?? 0), row.deaths ?? 0),
    netWorth: row.netWorth ?? 0,
  }));

  const perHero = aggregatePerHero(slicedRows, heroMap);
  const progressionSummary = await computeProgressionSummary(
    slicedRows,
    filter.heroId,
  );

  const [mmrHistory, mateStats, enemyStats, player, patches] =
    await Promise.all([
      deadlockClient.getPlayerMmrHistory(accountId).catch(() => []),
      deadlockClient.getPlayerMateStats(accountId).catch(() => []),
      deadlockClient.getPlayerEnemyStats(accountId).catch(() => []),
      prisma.player.findUnique({ where: { accountId } }),
      prisma.patch.findMany({ orderBy: { releasedAt: "desc" } }),
    ]);

  const filterHash = hashFilter(filter);
  await prisma.playerAggregate.upsert({
    where: {
      accountId_filterHash: {
        accountId,
        filterHash,
      },
    },
    update: {
      totalMatches,
      wins,
      winRate,
      avgKda,
      avgNetWorth,
      avgCs,
      recentForm: toJson(recentForm),
      perHero: toJson(perHero),
      mmrHistory: toJson(mmrHistory),
      mateEnemy: toJson({ mates: mateStats, enemies: enemyStats }),
      progressionSummary: toJson(progressionSummary),
    },
    create: {
      accountId,
      filterHash,
      totalMatches,
      wins,
      winRate,
      avgKda,
      avgNetWorth,
      avgCs,
      recentForm: toJson(recentForm),
      perHero: toJson(perHero),
      mmrHistory: toJson(mmrHistory),
      mateEnemy: toJson({ mates: mateStats, enemies: enemyStats }),
      progressionSummary: toJson(progressionSummary),
    },
  });

  return {
    accountId,
    player: {
      accountId,
      personaName: player?.personaName ?? null,
      avatarUrl: player?.avatarUrl ?? null,
      trackerRating: trackerRating.currentRating,
      lastRefreshedAt: player?.lastRefreshedAt?.toISOString() ?? null,
    },
    filter,
    availablePatches: patches.map((patch) => ({
      patchId: patch.patchId,
      title: patch.title,
      releasedAt: patch.releasedAt.toISOString(),
    })),
    totals: {
      totalMatches,
      wins,
      winRate: rounded(winRate),
      avgKda: rounded(avgKda),
      avgNetWorth: rounded(avgNetWorth),
      avgCs: rounded(avgCs),
    },
    perHero,
    recentForm,
    progression: progressionSummary,
    trackerRating,
    mmrHistory,
    mateStats,
    enemyStats,
    matches,
  };
}

export async function getMatchStats(matchId: string) {
  const numeric = BigInt(matchId);
  const match = await prisma.match.findUnique({
    where: { matchId: numeric },
    include: {
      players: {
        orderBy: { netWorth: "desc" },
      },
      patch: true,
    },
  });

  if (!match) {
    return null;
  }
  const heroMap = await getHeroMap();

  const teamBuckets = new Map<
    number,
    { netWorth: number; damage: number; count: number }
  >();
  for (const row of match.players) {
    const team = row.playerTeam ?? -1;
    const bucket = teamBuckets.get(team) ?? {
      netWorth: 0,
      damage: 0,
      count: 0,
    };
    bucket.netWorth += row.netWorth ?? 0;
    bucket.damage += row.damageDealt ?? 0;
    bucket.count += 1;
    teamBuckets.set(team, bucket);
  }

  return {
    matchId: match.matchId.toString(),
    startTime: match.startTime.toISOString(),
    patchId: match.patchId,
    patchTitle: match.patch?.title ?? null,
    gameMode: match.gameMode,
    matchMode: match.matchMode,
    durationSec: match.durationSec,
    teams: [...teamBuckets.entries()].map(([team, values]) => ({
      team,
      avgNetWorth: values.count ? rounded(values.netWorth / values.count) : 0,
      totalDamage: values.damage,
      players: values.count,
    })),
    players: match.players.map((row) => ({
      accountId: row.accountId,
      heroId: row.heroId,
      heroName: row.heroId ? (heroMap.get(row.heroId)?.name ?? null) : null,
      heroIcon: row.heroId ? (heroMap.get(row.heroId)?.iconUrl ?? null) : null,
      team: row.playerTeam,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      kda: ratio((row.kills ?? 0) + (row.assists ?? 0), row.deaths ?? 0),
      netWorth: row.netWorth,
      lastHits: row.lastHits,
      denies: row.denies,
      damageDealt: row.damageDealt,
      damageTaken: row.damageTaken,
      objectiveDamage: row.objectiveDamage,
      healingDone: row.healingDone,
      itemBuild: row.itemBuild,
      abilityBuild: row.abilityBuild,
      progressionCurve: row.progressionCurve,
      win: row.win,
    })),
  };
}

type QueueCategory = "solo" | "unsure" | "party" | "high_elo_repeat";

interface TrackerTimelineEntry {
  matchId: string;
  queueCategory: QueueCategory;
  queueWeight: number;
  trackerBefore: number;
  trackerDelta: number;
  trackerAfter: number;
  matchAvgRank: number;
}

interface TrackerRatingSummary {
  currentRating: number;
  baseline: number;
  timeline: TrackerTimelineEntry[];
  queueBreakdown: Record<QueueCategory, number>;
}

function computeTrackerRating(
  accountId: number,
  rows: Array<{
    matchId: bigint;
    win: boolean | null;
    playerTeam: number | null;
    match: {
      startTime: Date;
      players: Array<{
        accountId: number;
        playerTeam: number | null;
        rankTier: string | null;
        rankDivision: number | null;
        rankSubrank: number | null;
      }>;
    };
  }>,
): TrackerRatingSummary {
  const BASE_RATING = 1000;
  const K_FACTOR = 24;
  const LOOKBACK_MATCHES = 20;
  const PARTY_THRESHOLD = 3;
  const WEIGHT_BY_QUEUE: Record<QueueCategory, number> = {
    solo: 1.25,
    unsure: 1.0,
    party: 0.65,
    high_elo_repeat: 1.0,
  };

  const ascending = [...rows].sort(
    (a, b) => a.match.startTime.getTime() - b.match.startTime.getTime(),
  );

  const timeline: TrackerTimelineEntry[] = [];
  const queueBreakdown: Record<QueueCategory, number> = {
    solo: 0,
    unsure: 0,
    party: 0,
    high_elo_repeat: 0,
  };
  const ratingMap = new Map<number, number>();
  let rating = BASE_RATING;
  ratingMap.set(accountId, rating);

  for (let index = 0; index < ascending.length; index += 1) {
    const row = ascending[index];
    const team = row.playerTeam;
    const players = row.match.players;
    const teammates =
      team === null
        ? []
        : players
            .filter(
              (player) =>
                player.accountId !== accountId && player.playerTeam === team,
            )
            .map((player) => player.accountId);
    const enemies =
      team === null
        ? []
        : players
            .filter(
              (player) =>
                player.playerTeam !== null && player.playerTeam !== team,
            )
            .map((player) => player.accountId);

    const lookback = ascending.slice(
      Math.max(0, index - LOOKBACK_MATCHES),
      index,
    );
    const teammateCounts = buildPeerFrequency(accountId, lookback, "teammates");
    const enemyCounts = buildPeerFrequency(accountId, lookback, "enemies");

    const hasFrequentTeammate = teammates.some(
      (id) => (teammateCounts.get(id) ?? 0) > PARTY_THRESHOLD,
    );
    const hasFrequentEnemy = enemies.some(
      (id) => (enemyCounts.get(id) ?? 0) > PARTY_THRESHOLD,
    );

    const queueCategory: QueueCategory =
      team === null || players.length === 0
        ? "unsure"
        : hasFrequentTeammate && !hasFrequentEnemy
          ? "party"
          : hasFrequentTeammate && hasFrequentEnemy
            ? "high_elo_repeat"
            : "solo";
    const weight = WEIGHT_BY_QUEUE[queueCategory];
    queueBreakdown[queueCategory] += 1;

    const before = rating;
    const matchAvgRank = computeMatchAverageRankSignal(
      players,
      ratingMap,
      BASE_RATING,
    );
    const expected = logisticExpected(before, matchAvgRank);
    const outcome = row.win === null ? 0.5 : row.win ? 1 : 0;
    const delta = (outcome - expected) * K_FACTOR * weight;
    const after = Math.max(100, before + delta);

    rating = after;
    ratingMap.set(accountId, after);

    timeline.push({
      matchId: row.matchId.toString(),
      queueCategory,
      queueWeight: rounded(weight),
      trackerBefore: rounded(before),
      trackerDelta: rounded(delta),
      trackerAfter: rounded(after),
      matchAvgRank: rounded(matchAvgRank),
    });
  }

  return {
    currentRating: rounded(rating),
    baseline: BASE_RATING,
    timeline: timeline.reverse(),
    queueBreakdown,
  };
}

function buildPeerFrequency(
  accountId: number,
  rows: Array<{
    playerTeam: number | null;
    match: {
      players: Array<{ accountId: number; playerTeam: number | null }>;
    };
  }>,
  side: "teammates" | "enemies",
) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const team = row.playerTeam;
    if (team === null) {
      continue;
    }
    const peers =
      side === "teammates"
        ? row.match.players.filter(
            (player) =>
              player.accountId !== accountId && player.playerTeam === team,
          )
        : row.match.players.filter(
            (player) =>
              player.playerTeam !== null && player.playerTeam !== team,
          );
    for (const peer of peers) {
      counts.set(peer.accountId, (counts.get(peer.accountId) ?? 0) + 1);
    }
  }
  return counts;
}

function computeMatchAverageRankSignal(
  players: Array<{
    accountId: number;
    rankTier: string | null;
    rankDivision: number | null;
    rankSubrank: number | null;
  }>,
  ratingMap: Map<number, number>,
  fallback: number,
) {
  const signals = players.map((player) => {
    const explicit = rankSignal(
      player.rankTier,
      player.rankDivision,
      player.rankSubrank,
    );
    if (explicit !== null) {
      return explicit;
    }
    return ratingMap.get(player.accountId) ?? fallback;
  });
  return average(signals);
}

function rankSignal(
  rankTier: string | null,
  rankDivision: number | null,
  rankSubrank: number | null,
) {
  if (typeof rankDivision === "number") {
    return 1200 + rankDivision * 55 + (rankSubrank ?? 0) * 10;
  }
  if (rankTier) {
    const numeric = Number(rankTier);
    if (Number.isFinite(numeric)) {
      return 1200 + numeric * 60;
    }
  }
  return null;
}

function logisticExpected(playerRating: number, lobbyAverage: number) {
  return 1 / (1 + 10 ** ((lobbyAverage - playerRating) / 400));
}

function aggregatePerHero(
  rows: Array<{
    heroId: number | null;
    win: boolean | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    netWorth: number | null;
  }>,
  heroMap: Map<number, { name: string; iconUrl: string | null }>,
) {
  const buckets = new Map<
    number,
    { games: number; wins: number; kdaSum: number; netWorthSum: number }
  >();

  for (const row of rows) {
    if (!row.heroId) {
      continue;
    }
    const bucket = buckets.get(row.heroId) ?? {
      games: 0,
      wins: 0,
      kdaSum: 0,
      netWorthSum: 0,
    };
    bucket.games += 1;
    if (row.win) {
      bucket.wins += 1;
    }
    bucket.kdaSum += ratio(
      (row.kills ?? 0) + (row.assists ?? 0),
      row.deaths ?? 0,
    );
    bucket.netWorthSum += row.netWorth ?? 0;
    buckets.set(row.heroId, bucket);
  }

  return [...buckets.entries()]
    .map(([heroId, values]) => ({
      heroId,
      heroName: heroMap.get(heroId)?.name ?? null,
      heroIcon: heroMap.get(heroId)?.iconUrl ?? null,
      games: values.games,
      wins: values.wins,
      winRate: rounded(values.games ? values.wins / values.games : 0),
      avgKda: rounded(values.games ? values.kdaSum / values.games : 0),
      avgNetWorth: rounded(
        values.games ? values.netWorthSum / values.games : 0,
      ),
    }))
    .sort((a, b) => b.games - a.games);
}

async function computeProgressionSummary(
  rows: Array<{
    netWorth: number | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    damageDealt: number | null;
    progressionCurve: unknown;
  }>,
  heroId?: number,
) {
  const benchmark = await deadlockClient
    .getPlayerPerformanceCurve({
      hero_id: heroId,
      resolution: 10,
    })
    .catch(() => [] as PlayerPerformanceCurvePoint[]);

  const benchmarkByTime = new Map<number, PlayerPerformanceCurvePoint>();
  benchmark.forEach((entry) => benchmarkByTime.set(entry.game_time, entry));

  const zScores: number[] = [];
  const phaseBuckets: Record<
    "early" | "mid" | "late",
    { count: number; soulsRate: number; kda: number; damageRate: number }
  > = {
    early: { count: 0, soulsRate: 0, kda: 0, damageRate: 0 },
    mid: { count: 0, soulsRate: 0, kda: 0, damageRate: 0 },
    late: { count: 0, soulsRate: 0, kda: 0, damageRate: 0 },
  };
  const lobbyPercentiles: number[] = [];

  for (const row of rows) {
    const finalNetWorth = row.netWorth ?? 0;
    const endBenchmark = benchmarkByTime.get(100);
    if (endBenchmark && endBenchmark.net_worth_std > 0) {
      zScores.push(
        (finalNetWorth - endBenchmark.net_worth_avg) /
          endBenchmark.net_worth_std,
      );
    }

    const kda = ratio((row.kills ?? 0) + (row.assists ?? 0), row.deaths ?? 0);
    const damage = row.damageDealt ?? 0;

    const curve = Array.isArray(row.progressionCurve)
      ? (row.progressionCurve as Array<Record<string, unknown>>)
      : [];
    if (curve.length === 0) {
      phaseBuckets.late.count += 1;
      phaseBuckets.late.soulsRate += finalNetWorth;
      phaseBuckets.late.kda += kda;
      phaseBuckets.late.damageRate += damage;
      continue;
    }

    curve.forEach((point) => {
      const pct = Number(point.timePct ?? point.game_time ?? 100);
      const phase = pct <= 33 ? "early" : pct <= 66 ? "mid" : "late";
      phaseBuckets[phase].count += 1;
      phaseBuckets[phase].soulsRate += Number(
        point.netWorth ?? point.net_worth ?? finalNetWorth,
      );
      phaseBuckets[phase].kda += Number(point.kda ?? kda);
      phaseBuckets[phase].damageRate += Number(point.damage ?? damage);
    });
  }

  rows.forEach((row) => {
    const values = rows
      .map((entry) => entry.netWorth ?? 0)
      .sort((a, b) => a - b);
    if (values.length === 0) {
      return;
    }
    const playerValue = row.netWorth ?? 0;
    const below = values.filter((value) => value < playerValue).length;
    lobbyPercentiles.push((below / values.length) * 100);
  });

  return {
    performanceIndex: {
      zScoreAvg: rounded(average(zScores)),
      zScoreSeries: zScores.map(rounded),
    },
    phaseSplits: {
      early: normalizePhase(phaseBuckets.early),
      mid: normalizePhase(phaseBuckets.mid),
      late: normalizePhase(phaseBuckets.late),
    },
    lobbyPercentileOverTime: {
      averagePercentile: rounded(average(lobbyPercentiles)),
      series: lobbyPercentiles.map((value, index) => ({
        index,
        percentile: rounded(value),
      })),
    },
    powerSpikes: estimatePowerSpikes(rows),
    leadAuc: rounded(average(rows.map((row) => row.netWorth ?? 0))),
    phaseImpactShare: {
      early: rounded(phaseBuckets.early.damageRate),
      mid: rounded(phaseBuckets.mid.damageRate),
      late: rounded(phaseBuckets.late.damageRate),
    },
  };
}

function normalizePhase(input: {
  count: number;
  soulsRate: number;
  kda: number;
  damageRate: number;
}) {
  return {
    soulsPerTick: rounded(input.count ? input.soulsRate / input.count : 0),
    avgKda: rounded(input.count ? input.kda / input.count : 0),
    damagePerTick: rounded(input.count ? input.damageRate / input.count : 0),
  };
}

function estimatePowerSpikes(
  rows: Array<{
    progressionCurve: unknown;
    netWorth: number | null;
  }>,
) {
  return rows
    .slice(0, 10)
    .map((row) => {
      const curve = Array.isArray(row.progressionCurve)
        ? (row.progressionCurve as Array<Record<string, unknown>>)
        : [];
      if (curve.length < 2) {
        return null;
      }
      let bestDelta = Number.NEGATIVE_INFINITY;
      let bestIndex = 0;
      for (let i = 1; i < curve.length; i += 1) {
        const prev = Number(
          curve[i - 1]?.netWorth ?? curve[i - 1]?.net_worth ?? 0,
        );
        const next = Number(curve[i]?.netWorth ?? curve[i]?.net_worth ?? 0);
        const delta = next - prev;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestIndex = i;
        }
      }
      return {
        tick: bestIndex,
        gain: rounded(bestDelta),
      };
    })
    .filter((entry): entry is { tick: number; gain: number } => Boolean(entry));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number, denominator: number) {
  if (denominator === 0) {
    return numerator;
  }
  return numerator / denominator;
}

function rounded(value: number) {
  return Number(value.toFixed(3));
}

function hashFilter(filter: StatsFilter) {
  return createHash("sha256").update(JSON.stringify(filter)).digest("hex");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
