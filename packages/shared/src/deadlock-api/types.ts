export interface PlayerMatchHistoryEntry {
  match_id: number;
  account_id: number;
  hero_id: number;
  hero_level: number;
  start_time: number;
  game_mode: number;
  match_mode: number;
  player_team: number;
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  denies: number;
  net_worth: number;
  last_hits: number;
  match_duration_s: number;
  match_result: number;
  objectives_mask_team0: number;
  objectives_mask_team1: number;
}

export interface MatchSaltsResponse {
  match_id: number;
  cluster_id: number | null;
  demo_url: string | null;
  metadata_url: string | null;
  metadata_salt: number | null;
  replay_salt: number | null;
}

export interface PlayerPerformanceCurvePoint {
  game_time: number;
  net_worth_avg: number;
  net_worth_std: number;
  kills_avg: number;
  kills_std: number;
  deaths_avg: number;
  deaths_std: number;
  assists_avg: number;
  assists_std: number;
}

export interface HeroAsset {
  id: number;
  name: string;
  images?: {
    icon_hero_card?: string;
    icon_image_small?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ItemAsset {
  id: number;
  name: string;
  item_slot_type?: string;
  image?: string;
  [key: string]: unknown;
}

export interface RankAsset {
  tier: number;
  name: string;
  images?: {
    small?: string;
    large?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PlayerCardResponse {
  account_id: number;
  ranked_badge_level?: number | null;
  ranked_rank?: number | null;
  ranked_subrank?: number | null;
  slots?: unknown[];
}

export interface PlayerAccountHeroStats {
  hero_id: number;
  stat_id: number;
  total_value: number;
  medals_bronze: number;
  medals_silver: number;
  medals_gold: number;
}

export interface PlayerAccountStatsResponse {
  account_id: number;
  stats: PlayerAccountHeroStats[];
}

export interface MateStatsEntry {
  mate_id: number;
  wins: number;
  matches_played: number;
  matches: number[];
}

export interface EnemyStatsEntry {
  enemy_id: number;
  wins: number;
  matches_played: number;
  matches: number[];
}

export interface MmrHistoryEntry {
  rank: number;
  division: number;
  [key: string]: unknown;
}

export interface SteamProfile {
  account_id: number;
  steam_id?: string;
  personaname?: string;
  avatarfull?: string;
  [key: string]: unknown;
}

export interface SteamSearchEntry {
  account_id: number;
  personaname?: string;
  avatarfull?: string;
  [key: string]: unknown;
}

export interface PatchEntry {
  id?: string | number;
  patch_id?: string | number;
  title?: string;
  name?: string;
  date?: string;
  released_at?: string;
  release_date?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export type MatchMetadataResponse = Record<string, unknown>;
export type GlobalLeaderboardEntry = Record<string, unknown>;
export type AnalyticsResponse = Record<string, unknown>;
