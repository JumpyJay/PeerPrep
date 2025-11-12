// =========================================================================
// == RANKING SERVICE TYPES
// ==
// == All event-related types have been removed to simplify the logic
// == to only support the "Refresh Button" workflow.
// =========================================================================

// -------------------------------------------------------------------------
// -- Internal Data Structures
// -------------------------------------------------------------------------

// This is the object stored in the 'user_ranking' table
export interface UserRanking {
  email: string;
  username: string;
  elo: number;
  rank: string;
  wins: number;
  losses: number;
  draws: number;
  last_updated_at?: Date; // Optional
}

// This is the data returned by the API for the leaderboard
export interface LeaderboardEntry {
  username: string;
  elo: number;
  rank: string;
  global_rank_position: number;
  wins: number;
  losses: number;
}