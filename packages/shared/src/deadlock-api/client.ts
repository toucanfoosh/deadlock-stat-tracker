import type {
  AnalyticsResponse,
  EnemyStatsEntry,
  GlobalLeaderboardEntry,
  HeroAsset,
  ItemAsset,
  MatchMetadataResponse,
  MatchSaltsResponse,
  MateStatsEntry,
  MmrHistoryEntry,
  PatchEntry,
  PlayerAccountStatsResponse,
  PlayerCardResponse,
  PlayerMatchHistoryEntry,
  PlayerPerformanceCurvePoint,
  RankAsset,
  SteamProfile,
  SteamSearchEntry,
} from "./types.js";

export interface DeadlockApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  maxRetries?: number;
  retryBaseMs?: number;
}

type QueryValue = string | number | boolean | undefined | null;
type Query = Record<string, QueryValue>;

export class DeadlockApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(options: DeadlockApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.deadlock-api.com").replace(
      /\/$/,
      "",
    );
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 4;
    this.retryBaseMs = options.retryBaseMs ?? 500;
  }

  async getPlayerMatchHistory(accountId: number, forceRefetch?: boolean) {
    return this.request<PlayerMatchHistoryEntry[]>(
      `/v1/players/${accountId}/match-history`,
      {
        force_refetch: forceRefetch,
      },
    );
  }

  async getMatchMetadata(matchId: number | string) {
    return this.request<MatchMetadataResponse>(
      `/v1/matches/${matchId}/metadata`,
    );
  }

  async getMatchSalts(matchId: number | string) {
    return this.request<MatchSaltsResponse>(`/v1/matches/${matchId}/salts`);
  }

  async getPlayerAccountStats(accountId: number) {
    return this.request<PlayerAccountStatsResponse>(
      `/v1/players/${accountId}/account-stats`,
    );
  }

  async getPlayerMateStats(accountId: number) {
    return this.request<MateStatsEntry[]>(
      `/v1/players/${accountId}/mate-stats`,
    );
  }

  async getPlayerEnemyStats(accountId: number) {
    return this.request<EnemyStatsEntry[]>(
      `/v1/players/${accountId}/enemy-stats`,
    );
  }

  async getPlayerMmrHistory(accountId: number, heroId?: number) {
    const path = heroId
      ? `/v1/players/${accountId}/mmr-history/${heroId}`
      : `/v1/players/${accountId}/mmr-history`;
    return this.request<MmrHistoryEntry[]>(path);
  }

  async getPlayerCard(accountId: number) {
    return this.request<PlayerCardResponse>(`/v1/players/${accountId}/card`);
  }

  async getPlayerPerformanceCurve(params: {
    hero_id?: number;
    game_mode?: number;
    rank?: number;
    resolution?: number;
    min_patch_id?: number;
    max_patch_id?: number;
  }) {
    return this.request<PlayerPerformanceCurvePoint[]>(
      "/v1/analytics/player-performance-curve",
      params,
    );
  }

  async getSteamProfile(query: { account_id?: number; steam_id?: string }) {
    if (query.account_id !== undefined) {
      const profile = await this.request<SteamProfile>(
        `/v1/players/${query.account_id}/steam`,
      );
      return [profile];
    }

    if (query.steam_id) {
      return this.request<SteamProfile[]>("/v1/players/steam", {
        account_ids: query.steam_id,
      });
    }

    return [];
  }

  async searchSteamProfile(search: string, limit = 25) {
    return this.request<SteamSearchEntry[]>("/v1/players/steam-search", {
      search_query: search,
      limit,
    });
  }

  async getHeroes() {
    return this.request<HeroAsset[]>("/v1/assets/heroes");
  }

  async getItems() {
    return this.request<ItemAsset[]>("/v1/assets/items");
  }

  async getRanks() {
    return this.request<RankAsset[]>("/v1/assets/ranks");
  }

  async getPatches() {
    try {
      return await this.request<PatchEntry[]>("/v2/patches");
    } catch {
      return this.request<PatchEntry[]>("/v1/patches");
    }
  }

  async getLeaderboard(region: string, query: Query = {}) {
    return this.request<GlobalLeaderboardEntry[]>(
      `/v1/leaderboard/${encodeURIComponent(region)}`,
      query,
    );
  }

  async getAnalytics(path: string, query: Query = {}) {
    return this.request<AnalyticsResponse>(path, query);
  }

  private async request<T>(path: string, query: Query = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = new Headers({
      Accept: "application/json",
    });
    if (this.apiKey) {
      headers.set("X-API-Key", this.apiKey);
    }

    let attempt = 0;
    while (true) {
      const response = await fetch(url, { headers });
      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.retryBaseMs * 2 ** attempt;
        await delay(waitMs);
        attempt += 1;
        continue;
      }

      const body = await safeRead(response);
      throw new Error(
        `Deadlock API request failed (${response.status}) ${response.statusText}: ${body}`,
      );
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeRead(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
