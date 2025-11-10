import { getConnectionPool } from "@/lib/db";
import { RankingRepository } from "./ranking.repository";
import { 
  SessionCompletedEvent, 
  QuestionSolvedEvent 
} from "./ranking.types"; // Correct types

/**
 * Calculates points for a solved question based on the new system.
 * Easy = 1 point
 * Medium = 2 points
 * Hard = 3 points
 */
function getPointsForDifficulty(difficulty: "EASY" | "MEDIUM" | "HARD"): number {
  switch (difficulty) {
    case "EASY": return 1;
    case "MEDIUM": return 2;
    case "HARD": return 3;
    default: return 0;
  }
}

// =========================================================================
// == RankingService
// == This service is the "brain" of the ranking system. It listens for events
// == published by other services and updates the database.
// =========================================================================
export const RankingService = {
  
  /**
   * HANDLES: 'SessionCompletedEvent'
   * * This function is triggered when a match ends.
   * It DOES NOT change the user's 'elo' or 'rank'.
   * It ONLY updates the 'wins', 'losses', and 'draws' columns.
   */
  async processSessionOutcome(event: SessionCompletedEvent): Promise<void> {
    const pool = await getConnectionPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN"); 

      // 1. Get and Lock rows for both users involved in the match
      const { userA, userB } = await RankingRepository.getAndLockUsersForUpdate(
        client,
        event.user_a_email,
        event.user_b_email
      );

      // 2. Update stats based on the outcome
      if (event.outcome === "A_WIN") userA.wins++;
      if (event.outcome === "B_WIN") userA.losses++;
      if (event.outcome === "DRAW") userA.draws++;

      if (event.outcome === "B_WIN") userB.wins++;
      if (event.outcome === "A_WIN") userB.losses++;
      if (event.outcome === "DRAW") userB.draws++;

      // 3. Save the W/L/D stats back to the DB
      await Promise.all([
        RankingRepository.updateMatchStats(client, userA),
        RankingRepository.updateMatchStats(client, userB),
      ]);

      await client.query("COMMIT"); 
    } catch (error) {
      await client.query("ROLLBACK"); 
      console.error("Failed to process match stats update:", error);
      throw error; 
    } finally {
      client.release();
    }
  },

  /**
   * HANDLES: 'QuestionSolvedEvent'
   * * This function is triggered when a user solves a question.
   * This is the *ONLY* function that updates the 'elo' (point score).
   * The 'rank' (Bronze, etc.) is updated automatically by the database
   * when the 'elo' score changes.
   */
  async processQuestionSolved(event: QuestionSolvedEvent): Promise<void> {
    // 1. Get the points for the question
    const points = getPointsForDifficulty(event.difficulty);
    if (points === 0) return; // No points to add

    try {
      // 2. Atomically add the points to the user's 'elo' column
      await RankingRepository.addEloPoints(event.email, points);
    } catch (error) {
      console.error(`Failed to add points for ${event.email}:`, error);
    }
  },

  // --- API Methods ---
  // (These are called by API routes for the frontend UI)
  
  async getLeaderboard(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return RankingRepository.getLeaderboard(limit, offset);
  },

  // This is used by the search box
  async getUserRank(username: string) {
    return RankingRepository.getUserRank(username);
  }
};