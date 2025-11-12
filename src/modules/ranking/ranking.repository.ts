import { getConnectionPool } from "@/lib/db";
import { Pool, PoolClient } from "pg";
import { LeaderboardEntry, UserRanking } from "./ranking.types";

let pool: Pool;

// Helper to get or create a user's rank row (uses email)
async function getOrCreateRank(client: PoolClient, email: string): Promise<UserRanking> {
  const res = await client.query(
    `SELECT * FROM user_ranking WHERE email = $1`,
    [email]
  );
  if (res.rows[0]) {
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

  // Not found, create it by copying from the 'users' table
  await client.query(
    `INSERT INTO user_ranking (email, username) 
     SELECT email, username FROM users WHERE email = $1 
     ON CONFLICT (email) DO NOTHING`,
    [email]
  );

  // Fetch the newly created (or existing) row
  const finalRes = await client.query(
    `SELECT * FROM user_ranking WHERE email = $1`,
    [email]
  );
  
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

export const RankingRepository = {
  // This backend function correctly uses email
  async getAndLockUsersForUpdate(
    client: PoolClient, 
    userA_email: string,
    userB_email: string
  ): Promise<{ userA: UserRanking; userB: UserRanking }> {
    
    await Promise.all([
      getOrCreateRank(client, userA_email),
      getOrCreateRank(client, userB_email)
    ]);

    const [id1, id2] = [userA_email, userB_email].sort();
    
    const { rows } = await client.query(
      `SELECT * FROM user_ranking
       WHERE email IN ($1, $2)
       ORDER BY email
       FOR UPDATE`,
      [id1, id2]
    );

    const userA_row = rows.find(r => r.email === userA_email);
    const userB_row = rows.find(r => r.email === userB_email);

    return { 
      userA: {
        email: userA_row.email,
        username: userA_row.username,
        elo: parseInt(userA_row.elo, 10),
        rank: userA_row.rank,
        wins: parseInt(userA_row.wins, 10),
        losses: parseInt(userA_row.losses, 10),
        draws: parseInt(userA_row.draws, 10),
      },
      userB: {
        email: userB_row.email,
        username: userB_row.username,
        elo: parseInt(userB_row.elo, 10),
        rank: userB_row.rank,
        wins: parseInt(userB_row.wins, 10),
        losses: parseInt(userB_row.losses, 10),
        draws: parseInt(userB_row.draws, 10),
      }
    };
  },

  // This backend function correctly uses email
  async updateMatchStats(
    client: PoolClient, 
    userRanking: UserRanking
  ): Promise<void> {
    await client.query(
      `UPDATE user_ranking
       SET
         wins = $2,
         losses = $3,
         draws = $4
       WHERE email = $1`,
      [
        userRanking.email,
        userRanking.wins,
        userRanking.losses,
        userRanking.draws,
      ]
    );
  },

  // This backend function correctly uses email
  async addEloPoints(email: string, points: number): Promise<void> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await getOrCreateRank(client, email);
      
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

  // --- THIS IS THE FIX ---
  async getUserRank(username: string): Promise<LeaderboardEntry | null> {
    if (!pool) pool = await getConnectionPool();
    const client = await pool.connect(); // <-- FIX 1: Define client
    try {
      const { rows } = await client.query(
        `WITH user_with_rank AS (
           SELECT
             username,
             elo,
             rank,
             wins,
             losses,
             draws,
             RANK() OVER (ORDER BY elo DESC) as global_rank_position
           FROM user_ranking
         )
         SELECT * FROM user_with_rank WHERE username = $1`,
        [username]
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error in getUserRank:", error);
      throw error; // Re-throw the error so the API route can catch it
    } finally {
      client.release(); // <-- FIX 2: Release client
    }
  }
};