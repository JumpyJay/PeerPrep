import { Pool } from "pg";
import { getConnectionPool } from "../../lib/db";
import { Session } from "./session.types";

/**
 * the repository layer is responsible for all direct database interactions
 * for the collaboration module.
 *  abstracts the SQL queries from the business logic.
 */
export class SessionRepository {
  private pool: Pool | undefined;

  // get all sessions from database
  public async findAll(): Promise<Session[]> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM sessions ORDER BY created_at DESC"
      );
      // result.rows property contains the array of records from the database.
      return result.rows;
    } catch (error) {
      console.error("Error fetching users from database:", error);
      throw new Error("Could not retrieve sessions.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }
}

// export a singleton instance of the repository
export const userRepository = new SessionRepository();
