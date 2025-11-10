// =========================================================================
// == RANKING SERVICE EVENTS
// ==
// == This file defines the "contract" for events the Ranking Service listens to.
// == Other services must publish events to the message queue with payloads
// == that match these interfaces EXACTLY.
// =========================================================================

// Represents the outcome of any two-player match
export type SessionOutcome = "A_WIN" | "B_WIN" | "DRAW";

// ---
// == EVENT 1: Match Completed
// == WHEN TO SEND: After any two-player match is finalized.
// == WHAT IT DOES: Updates the Win/Loss/Draw stats for both users.
// ---
export interface SessionCompletedEvent {
  // CRITICAL: This MUST be the user's EMAIL (the database primary key), 
  // not their username.
  user_a_email: string;

  // CRITICAL: This MUST be the user's EMAIL (the database primary key),
  // not their username.
  user_b_email: string;

  // The final outcome of the match.
  outcome: SessionOutcome;
  completed_at: string; // ISO 8601 string
}

// ---
// == EVENT 2: Question Solved
// == WHEN TO SEND: When a user successfully solves a question.
// == WHAT IT DOES: This is the *only* event that updates the user's
// ==               'elo' (point score) and their 'rank' (Bronze, etc.)
// ---
export interface QuestionSolvedEvent {
  // The EMAIL of the single user who solved the question.
  email: string;
  
  // The difficulty of the question they solved.
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

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