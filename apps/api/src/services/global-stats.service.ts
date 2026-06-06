import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { deadlockClient } from "./deadlock-client.js";

const GLOBAL_CACHE_TTL_MS = 15 * 60 * 1000;

export interface GlobalStatsFilter {
  patchId?: string;
  rank?: number;
  from?: string;
  to?: string;
  region?: string;
}

export async function getGlobalStats(filter: GlobalStatsFilter) {
  const key = cacheKey(filter);
  const cached = await prisma.globalStatsCache.findUnique({ where: { key } });
  const now = Date.now();
  if (cached && now - cached.updatedAt.getTime() < GLOBAL_CACHE_TTL_MS) {
    return cached.payload as Record<string, unknown>;
  }

  const query: Record<string, string | number> = {};
  if (filter.patchId) {
    query.patch_id = filter.patchId;
  }
  if (filter.rank) {
    query.rank = filter.rank;
  }
  if (filter.from) {
    query.start_date = filter.from;
  }
  if (filter.to) {
    query.end_date = filter.to;
  }

  const region = filter.region ?? "europe";

  const [
    heroStats,
    heroCounterStats,
    heroSynergyStats,
    heroBanStats,
    itemStats,
    buildItemStats,
    abilityOrderStats,
    badgeDistribution,
    gameStats,
    leaderboard,
  ] = await Promise.all([
    deadlockClient
      .getAnalytics("/v1/analytics/hero-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/hero-counter-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/hero-synergy-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/hero-ban-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/item-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/build-item-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/ability-order-stats", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/badge-distribution", query)
      .catch(() => ({})),
    deadlockClient
      .getAnalytics("/v1/analytics/game-stats", query)
      .catch(() => ({})),
    deadlockClient.getLeaderboard(region, query).catch(() => []),
  ]);

  const payload = {
    filter,
    generatedAt: new Date().toISOString(),
    heroStats,
    heroCounterStats,
    heroSynergyStats,
    heroBanStats,
    itemStats,
    buildItemStats,
    abilityOrderStats,
    badgeDistribution,
    gameStats,
    leaderboard,
  };

  await prisma.globalStatsCache.upsert({
    where: { key },
    update: { payload: payload as unknown as Prisma.InputJsonValue },
    create: { key, payload: payload as unknown as Prisma.InputJsonValue },
  });

  return payload;
}

function cacheKey(filter: GlobalStatsFilter) {
  return createHash("sha256").update(JSON.stringify(filter)).digest("hex");
}
