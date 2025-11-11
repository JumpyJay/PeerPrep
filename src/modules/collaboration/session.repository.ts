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

  // define create session function
  public async createSession(
    question_id: string,
    user1_email: string,
    user2_email: string
  ): Promise<Session> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "INSERT INTO sessions (question_id, user1_email, user2_email) VALUES ($1, $2, $3) RETURNING *",
        [question_id, user1_email, user2_email]
      );
      // result.rows property contains the array of records from the database.
      return result.rows[0];
    } catch (error) {
      console.error("Error creating session in database:", error);
      throw new Error("Could not create session.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }

  // define fund session function
  public async findSessionById(session_id: number): Promise<Session> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT * FROM sessions WHERE session_id = $1",
        [session_id]
      );
      // result.rows property contains the array of records from the database.
      return result.rows[0];
    } catch (error) {
      console.error("Error finding session in database:", error);
      throw new Error("Could not find session.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }

  // define termination session function
  public async finishSession(session_id: string): Promise<Session> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "UPDATE sessions SET is_completed = true WHERE session_id = $1 RETURNING *",
        [session_id]
      );
      // result.rows property contains the array of records from the database.
      return result.rows[0];
    } catch (error) {
      console.error("Error terminating session in database:", error);
      throw new Error("Could not terminate session.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }

  // define fetch submission function
  // return all matching submission where user1_email or user2_email matches
  public async findSubmissionByUser(user_email: string) {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      // retrieve submission
      const submissionres = await client.query(
        "SELECT * FROM submissions WHERE user1_email = $1 OR user2_email = $1",
        [user_email]
      );
      // result.rows property contains the array of records from the database.
      return submissionres.rows || [];
    } catch (error) {
      console.log("error during fetch submissions: ", error);
      throw new Error("Could not fetch submissions.");
    } finally {
      client.release;
    }
  }

  public async createSubmission(session_id: string, code_solution: string) {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      // retrieve question_id, user1_email, user2_email
      const inforesult = await client.query(
        "SELECT question_id, user1_email, user2_email FROM sessions WHERE session_id = $1",
        [session_id]
      );

      const { question_id, user1_email, user2_email } = inforesult.rows[0];

      const result = await client.query(
        "INSERT INTO submissions (question_id, user1_email, user2_email, users_solution, session_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [question_id, user1_email, user2_email, code_solution, session_id]
      );
      // result.rows property contains the array of records from the database.
      return result.rows[0];
    } catch (error) {
      console.error("Error terminating session in database:", error);
      throw new Error("Could not terminate session.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }
}

// export a singleton instance of the repository
export const sessionRepository = new SessionRepository();
