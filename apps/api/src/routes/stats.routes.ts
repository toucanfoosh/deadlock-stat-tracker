import { steamId64FromProfile } from "@deadlock/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deadlockClient } from "../services/deadlock-client.js";
import { registerProfile } from "../services/ingest.service.js";
import { getMatchStats, getPlayerStats } from "../services/stats.service.js";
import { toInt } from "../utils/number.js";

const querySchema = z.object({
  lastGames: z.coerce.number().int().positive().optional(),
  patchId: z.string().optional(),
  heroId: z.coerce.number().int().positive().optional(),
});

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/profiles/search", async (request, reply) => {
    const q = String((request.query as { q?: string }).q ?? "").trim();
    const limitRaw = Number((request.query as { limit?: string }).limit ?? 25);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(25, Math.trunc(limitRaw)))
      : 25;

    if (!q) {
      return reply.code(400).send({ error: "q is required" });
    }

    const results: Array<{
      accountId: number;
      personaName: string | null;
      avatarUrl: string | null;
      steamId64: string | null;
      source: "accountId" | "steamId" | "steamSearch";
    }> = [];
    const seen = new Set<number>();

    if (/^\d+$/.test(q)) {
      const numeric = Number(q);
      const directByAccount = await deadlockClient
        .getSteamProfile({ account_id: numeric })
        .catch(() => []);
      if (
        directByAccount.length > 0 &&
        !seen.has(directByAccount[0].account_id)
      ) {
        seen.add(directByAccount[0].account_id);
        results.push({
          accountId: directByAccount[0].account_id,
          personaName: directByAccount[0].personaname ?? null,
          avatarUrl: directByAccount[0].avatarfull ?? null,
          steamId64: steamId64FromProfile(directByAccount[0]),
          source: "accountId",
        });
      }
    }

    const direct = await deadlockClient
      .getSteamProfile({ steam_id: q })
      .catch(() => []);
    if (direct.length > 0 && !seen.has(direct[0].account_id)) {
      seen.add(direct[0].account_id);
      results.push({
        accountId: direct[0].account_id,
        personaName: direct[0].personaname ?? null,
        avatarUrl: direct[0].avatarfull ?? null,
        steamId64: steamId64FromProfile(direct[0]),
        source: "steamId",
      });
    }

    const search = await deadlockClient
      .searchSteamProfile(q, limit)
      .catch(() => []);
    for (const entry of search) {
      if (results.length >= limit) {
        break;
      }
      if (seen.has(entry.account_id)) {
        continue;
      }
      seen.add(entry.account_id);
      results.push({
        accountId: entry.account_id,
        personaName: entry.personaname ?? null,
        avatarUrl: entry.avatarfull ?? null,
        steamId64: steamId64FromProfile(entry),
        source: "steamSearch",
      });
    }

    return reply.send({
      query: q,
      total: results.length,
      results,
    });
  });

  app.post("/api/profiles/register", async (request, reply) => {
    const body = request.body as {
      accountId?: number;
      personaName?: string;
      avatarUrl?: string;
      steamId64?: string;
    };
    const accountId = toInt(body?.accountId);
    if (!accountId) {
      return reply.code(400).send({ error: "accountId is required" });
    }

    const profile = await registerProfile({
      accountId,
      personaName: body?.personaName,
      avatarUrl: body?.avatarUrl,
      steamId64: body?.steamId64,
      enrichFromSteam: true,
    });

    return reply.send({ profile });
  });

  app.get("/api/profiles/resolve", async (request, reply) => {
    const q = String((request.query as { q?: string }).q ?? "").trim();
    if (!q) {
      return reply.code(400).send({ error: "q is required" });
    }

    if (/^\d+$/.test(q)) {
      const profile = await registerProfile({
        accountId: Number(q),
        enrichFromSteam: true,
      });
      return reply.send({
        accountId: profile.accountId,
        source: "accountId",
        personaName: profile.personaName,
        avatarUrl: profile.avatarUrl,
      });
    }

    const direct = await deadlockClient
      .getSteamProfile({ steam_id: q })
      .catch(() => []);
    if (direct.length > 0) {
      return reply.send({
        accountId: (
          await registerProfile({
            accountId: direct[0].account_id,
            personaName: direct[0].personaname ?? undefined,
            avatarUrl: direct[0].avatarfull ?? undefined,
            steamId64: steamId64FromProfile(direct[0]) ?? undefined,
            enrichFromSteam: true,
          })
        ).accountId,
        source: "steamId",
        personaName: direct[0].personaname ?? null,
        avatarUrl: direct[0].avatarfull ?? null,
      });
    }

    const search = await deadlockClient.searchSteamProfile(q, 1).catch(() => []);
    if (search.length === 0) {
      return reply.code(404).send({ error: "No profile found" });
    }

    return reply.send({
      accountId: (
        await registerProfile({
          accountId: search[0].account_id,
          personaName: search[0].personaname ?? undefined,
          avatarUrl: search[0].avatarfull ?? undefined,
          steamId64: steamId64FromProfile(search[0]) ?? undefined,
          enrichFromSteam: true,
        })
      ).accountId,
      source: "steamSearch",
      personaName: search[0].personaname ?? null,
      avatarUrl: search[0].avatarfull ?? null,
    });
  });

  app.get("/api/players/:accountId/stats", async (request, reply) => {
    const accountId = toInt(
      (request.params as { accountId?: string }).accountId,
    );
    if (!accountId) {
      return reply.code(400).send({ error: "Invalid accountId" });
    }

    const parsedQuery = querySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid query params",
        details: parsedQuery.error.issues,
      });
    }

    const stats = await getPlayerStats(accountId, parsedQuery.data);
    return reply.send(stats);
  });

  app.get("/api/matches/:matchId", async (request, reply) => {
    const matchId = (request.params as { matchId?: string }).matchId;
    if (!matchId || !/^\d+$/.test(matchId)) {
      return reply.code(400).send({ error: "Invalid matchId" });
    }

    const stats = await getMatchStats(matchId);
    if (!stats) {
      return reply.code(404).send({ error: "Match not found" });
    }
    return reply.send(stats);
  });
};
