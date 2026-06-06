const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface ProfileStatsResponse {
  accountId: number;
  player: {
    accountId: number;
    personaName: string | null;
    avatarUrl: string | null;
    trackerRating: number;
    lastRefreshedAt: string | null;
  };
  filter: {
    lastGames?: number;
    patchId?: string;
    heroId?: number;
  };
  availablePatches: Array<{
    patchId: string;
    title: string;
    releasedAt: string;
  }>;
  totals: {
    totalMatches: number;
    wins: number;
    winRate: number;
    avgKda: number;
    avgNetWorth: number;
    avgCs: number;
  };
  perHero: Array<{
    heroId: number;
    heroName: string | null;
    heroIcon: string | null;
    games: number;
    wins: number;
    winRate: number;
    avgKda: number;
    avgNetWorth: number;
  }>;
  recentForm: Array<{
    matchId: string;
    win: boolean;
    heroId: number | null;
    kda: number;
    netWorth: number;
  }>;
  progression: {
    performanceIndex: {
      zScoreAvg: number;
      zScoreSeries: number[];
    };
    phaseSplits: Record<
      string,
      { soulsPerTick: number; avgKda: number; damagePerTick: number }
    >;
    lobbyPercentileOverTime: {
      averagePercentile: number;
      series: Array<{ index: number; percentile: number }>;
    };
    powerSpikes: Array<{ tick: number; gain: number }>;
    leadAuc: number;
    phaseImpactShare: Record<string, number>;
  };
  trackerRating: {
    currentRating: number;
    baseline: number;
    timeline: Array<{
      matchId: string;
      queueCategory: "solo" | "unsure" | "party" | "high_elo_repeat";
      queueWeight: number;
      trackerBefore: number;
      trackerDelta: number;
      trackerAfter: number;
      matchAvgRank: number;
    }>;
    queueBreakdown: Record<
      "solo" | "unsure" | "party" | "high_elo_repeat",
      number
    >;
  };
  mmrHistory: unknown[];
  mateStats: unknown[];
  enemyStats: unknown[];
  matches: Array<{
    matchId: string;
    startTime: string;
    patchId: string | null;
    heroId: number | null;
    heroName: string | null;
    heroIcon: string | null;
    durationSec: number | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    netWorth: number | null;
    lastHits: number | null;
    denies: number | null;
    damageDealt: number | null;
    damageTaken: number | null;
    objectiveDamage: number | null;
    healingDone: number | null;
    win: boolean | null;
    queueCategory: "solo" | "unsure" | "party" | "high_elo_repeat" | "unknown";
    queueWeight: number;
    trackerBefore: number | null;
    trackerDelta: number | null;
    trackerAfter: number | null;
    matchAvgRank: number | null;
    itemBuild: unknown;
    abilityBuild: unknown;
  }>;
}

export interface GlobalStatsResponse {
  filter: Record<string, unknown>;
  generatedAt: string;
  heroStats: Record<string, unknown>;
  heroCounterStats: Record<string, unknown>;
  heroSynergyStats: Record<string, unknown>;
  heroBanStats: Record<string, unknown>;
  itemStats: Record<string, unknown>;
  buildItemStats: Record<string, unknown>;
  abilityOrderStats: Record<string, unknown>;
  badgeDistribution: Record<string, unknown>;
  gameStats: Record<string, unknown>;
  leaderboard: Array<Record<string, unknown>>;
}

export interface ProfileSearchResult {
  accountId: number;
  personaName: string | null;
  avatarUrl: string | null;
  steamId64: string | null;
  source: "accountId" | "steamId" | "steamSearch";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export function resolveProfile(query: string) {
  return request<{ accountId: number }>(
    `/api/profiles/resolve?q=${encodeURIComponent(query)}`,
  );
}

export function searchProfiles(query: string, limit = 25) {
  return request<{
    query: string;
    total: number;
    results: ProfileSearchResult[];
  }>(`/api/profiles/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function registerProfile(payload: {
  accountId: number;
  personaName?: string | null;
  avatarUrl?: string | null;
  steamId64?: string | null;
}) {
  return request<{ profile: ProfileSearchResult }>("/api/profiles/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPlayerStats(
  accountId: string,
  params: {
    lastGames?: number;
    patchId?: string;
    heroId?: number;
  },
) {
  const search = new URLSearchParams();
  if (params.lastGames) {
    search.set("lastGames", String(params.lastGames));
  }
  if (params.patchId) {
    search.set("patchId", params.patchId);
  }
  if (params.heroId) {
    search.set("heroId", String(params.heroId));
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<ProfileStatsResponse>(
    `/api/players/${accountId}/stats${suffix}`,
  );
}

export function refreshProfile(accountId: string) {
  return request<{
    newMatchesFetched: number;
    existingMatchesSkipped: number;
    lastRefreshedAt: string;
  }>(`/api/players/${accountId}/refresh`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getGlobalStats(params: {
  patchId?: string;
  rank?: number;
  from?: string;
  to?: string;
  region?: string;
}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<GlobalStatsResponse>(`/api/global-stats${suffix}`);
}

export function uploadHttpcache(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return fetch(`${API_BASE}/api/ingest/httpcache`, {
    method: "POST",
    body: formData,
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json() as Promise<Record<string, unknown>>;
  });
}

export function manualIngest(payload: {
  accountId?: number;
  steamId?: string;
  matchIds?: number[];
}) {
  return request<Record<string, unknown>>("/api/ingest/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
