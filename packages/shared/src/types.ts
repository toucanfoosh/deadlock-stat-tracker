export type MatchId = string;

export type RefreshMode = "daily" | "manual";

export interface RefreshSummary {
  accountId: number;
  newMatches: number;
  refreshedAt: string;
}
