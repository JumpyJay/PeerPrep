import { getConnectionPool } from "@/lib/db";
import { RankingRepository } from "./ranking.repository";
import { SessionCompletedEvent, SessionOutcome, UserRanking, QuestionSolvedEvent } from "./ranking.types"; // Correct types

/**
 * Calculates points for a solved question.
 */
function getPointsForDifficulty(difficulty: "EASY" | "MEDIUM" | "HARD"): number {
  switch (difficulty) {
    case "EASY": return 1;
    case "MEDIUM": return 2;
    case "HARD": return 3;
    default: return 0;
  }
}

// These functions are no longer needed
// function getDisplayRank(rating: number): string { ... }
// function calculateElo(...) { ... }

export const RankingService = {
  
  async processSessionOutcome(event: SessionCompletedEvent): Promise<void> {
    const pool = await getConnectionPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN"); 

      // --- THIS IS THE FIX ---
      // Now passing the correct email properties from the event
      const { userA, userB } = await RankingRepository.getAndLockUsersForUpdate(
        client,
        event.user_a_email, // <-- Changed
        event.user_b_email  // <-- Changed
      );

      // Update User A's stats
      if (event.outcome === "A_WIN") userA.wins++;
      if (event.outcome === "B_WIN") userA.losses++;
      if (event.outcome === "DRAW") userA.draws++;

      // Update User B's stats
      if (event.outcome === "B_WIN") userB.wins++;
      if (event.outcome === "A_WIN") userB.losses++;
      if (event.outcome === "DRAW") userB.draws++;

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
   * Processes a 'question_solved' event to add points to 'elo'.
   */
  async processQuestionSolved(event: QuestionSolvedEvent): Promise<void> {
    const points = getPointsForDifficulty(event.difficulty);
    if (points === 0) return;

    try {
      await RankingRepository.addEloPoints(event.email, points);
    } catch (error) {
      console.error(`Failed to add points for ${event.email}:`, error);
    }
  },

  // --- API Methods ---
  
  async getLeaderboard(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return RankingRepository.getLeaderboard(limit, offset);
  },

  // This is correct and matches your UI
  async getUserRank(username: string) {
    return RankingRepository.getUserRank(username);
  }
};