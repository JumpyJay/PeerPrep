import { RankingRepository } from "./ranking.repository";

// --- 1. ADD THESE IMPORTS ---
// We need these to read the submissions and questions tables
import { sessionRepository } from "../collaboration/session.repository";
import { questionService } from "../question/question.service";
// -----------------------------

/**
 * Calculates points for a solved question.
 */
function getPointsForDifficulty(
  difficulty: "EASY" | "MEDIUM" | "HARD"
): number {
  switch (difficulty) {
    case "EASY":
      return 1;
    case "MEDIUM":
      return 2;
    case "HARD":
      return 3;
    default:
      return 0;
  }
}

// =========================================================================
// == RankingService
// == This service handles the Leaderboard, User Search, and Rank Recalculation.
// =========================================================================
export const RankingService = {
  // --- 'processSessionOutcome' and 'processQuestionSolved' are DELETED ---

  // --- API Methods (for your UI) ---

  async getLeaderboard(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return RankingRepository.getLeaderboard(limit, offset);
  },

  async getUserRank(username: string) {
    return RankingRepository.getUserRank(username);
  },

  // --- THIS IS THE "REFRESH BUTTON" FUNCTION THAT WAS MISSING ---
  async recalculateAllRanks(): Promise<{
    status: string;
    submissionsProcessed: number;
    usersUpdated: number;
  }> {
    try {
      console.log("[RankingService] Starting full rank recalculation...");

      // 1. Get all submissions from the submissions table
      const allSubmissions = await sessionRepository.findAllSubmissions();
      // 2. Get all questions to find their difficulty
      const allQuestions = await questionService.getAllQuestions();

      // Create a quick lookup map for question difficulty
      const difficultyMap = new Map<number, "EASY" | "MEDIUM" | "HARD">();
      allQuestions.forEach((q) => {
        difficultyMap.set(
          q.question_id,
          q.difficulty.toUpperCase() as "EASY" | "MEDIUM" | "HARD"
        );
      });

      // 3. Reset all ELO scores to 0
      await RankingRepository.resetAllEloScores();

      // 4. Create a temporary map to store new scores
      const userScores = new Map<string, number>();

      // 5. Loop through every submission and calculate points
      for (const submission of allSubmissions) {
        const difficulty = difficultyMap.get(submission.question_id);
        if (!difficulty) continue;

        const points = getPointsForDifficulty(difficulty);
        if (points === 0) continue;

        userScores.set(
          submission.user1_email,
          (userScores.get(submission.user1_email) || 0) + points
        );
        userScores.set(
          submission.user2_email,
          (userScores.get(submission.user2_email) || 0) + points
        );
      }

      // 6. Update the database with new scores
      const updatePromises = [];
      for (const [email, totalPoints] of userScores.entries()) {
        updatePromises.push(RankingRepository.addEloPoints(email, totalPoints));
      }

      await Promise.all(updatePromises);

      console.log("[RankingService] Recalculation complete.");
      return {
        status: "success",
        submissionsProcessed: allSubmissions.length,
        usersUpdated: userScores.size,
      };
    } catch (error) {
      console.error("[RankingService] Recalculation failed:", error);
      return { status: "error", submissionsProcessed: 0, usersUpdated: 0 };
    }
  },
};
