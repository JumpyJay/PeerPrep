import { getConnectionPool } from "@/lib/db";
import { Pool, PoolClient } from "pg";
import { LeaderboardEntry, UserRanking } from "./ranking.types";

let pool: Pool;

// --- THIS FUNCTION IS THE FIX ---
/**
 * Helper to get or create a user's rank row.
 * It now returns 'null' if the user is "orphaned" (not in the 'users' table).
 */
async function getOrCreateRank(client: PoolClient, email: string): Promise<UserRanking | null> {
  // 1. Try to find the user in user_ranking
  const res = await client.query(
    `SELECT * FROM user_ranking WHERE email = $1`,
    [email]
  );
  if (res.rows[0]) {
    // User already exists in ranking, return them
    const r = res.rows[0];
    return {
      email: r.email,
      username: r.username,
      elo: parseInt(r.elo, 10),
      rank: r.rank,
      wins: parseInt(r.wins, 10),
      losses: parseInt(r.losses, 10),
      draws: parseInt(r.draws, 10),
    };
  }

  // 2. User not in ranking. Check if they exist in the main 'users' table.
  const userRes = await client.query(
    `SELECT username FROM users WHERE email = $1`,
    [email]
  );
  
  if (!userRes.rows[0]) {
    // --- THIS IS THE KEY ---
    // The user is "orphaned" (e.g., hoho@mail.com).
    // We cannot create a ranking entry for them.
    console.warn(`[getOrCreateRank] Skipping orphaned user: ${email}. Not found in 'users' table.`);
    return null; // Return null to stop the process.
  }
  
  const { username } = userRes.rows[0];

  // 3. User exists in 'users' but not in 'user_ranking'. Create them.
  const finalRes = await client.query(
    `INSERT INTO user_ranking (email, username) 
     VALUES ($1, $2)
     RETURNING *`, // RETURNING * gets us the new row
    [email, username]
  );

  // 4. Return the new user
  const r = finalRes.rows[0];
  return {
    email: r.email,
    username: r.username,
    elo: parseInt(r.elo, 10),
    rank: r.rank,
    wins: parseInt(r.wins, 10),
    losses: parseInt(r.losses, 10),
    draws: parseInt(r.draws, 10),
  };
}
// --- END OF CORRECTED FUNCTION ---

export const RankingRepository = {
  // --- 'getAndLockUsersForUpdate' and 'updateMatchStats' are REMOVED ---

  // --- THIS FUNCTION IS ALSO FIXED ---
  // This backend function is needed by 'recalculateAllRanks'
  async addEloPoints(email: string, points: number): Promise<void> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      // 1. Get or create the user. This might return null.
      const user = await getOrCreateRank(client, email);
      
      // 2. Check if the user was orphaned.
      if (!user) {
        // User is orphaned, so we just skip them.
        await client.query("COMMIT"); // Commit the (empty) transaction
        return; // Stop here.
      }
      
      // 3. User exists, add their points.
      await client.query(
        `UPDATE user_ranking SET elo = elo + $2 WHERE email = $1`,
        [email, points]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to add elo points:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  // This is needed by 'recalculateAllRanks'
  async resetAllEloScores(): Promise<void> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect();
    try {
      console.log("[RankingRepository] Resetting all elo scores to 0...");
      await client.query(`UPDATE user_ranking SET elo = 0`);
      console.log("[RankingRepository] Reset complete.");
    } catch (error) {
      console.error("Error resetting elo scores:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  // This is needed by the UI Leaderboard
  async getLeaderboard(limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT
           username,
           elo,
           rank,
           wins,
           losses,
           RANK() OVER (ORDER BY elo DESC) as global_rank_position
         FROM user_ranking
         ORDER BY elo DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return rows;
    } catch (error) {
      console.error("Error in getLeaderboard:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  // This is needed by the UI Search Bar
  async getUserRank(username: string): Promise<LeaderboardEntry | null> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect(); 
    try {
      const { rows } = await client.query(
        `WITH user_with_rank AS (
           SELECT
             username,
             elo,
             rank,
             wins,
             losses,
             RANK() OVER (ORDER BY elo DESC) as global_rank_position
           FROM user_ranking
         )
         SELECT * FROM user_with_rank WHERE username = $1`,
        [username]
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error in getUserRank:", error);
      throw error; 
    } finally {
      client.release();
    }
  }
};