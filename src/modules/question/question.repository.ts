import { Pool } from "pg";
import { getConnectionPool } from "../../lib/db";
import { Question, Difficulty } from "./question.types";

/**
 * the repository layer is responsible for all direct database interactions
 * for the question module.
 *  abstracts the SQL queries from the business logic.
 */
export class QuestionRepository {
  private pool: Pool | undefined;

  public async findAll(): Promise<Question[]> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query("SELECT * FROM questions");
      // result.rows property contains the array of records from the database.
      return result.rows;
    } catch (error) {
      console.error("Error fetching questions from database:", error);
      throw new Error("Could not retrieve questions.");
    } finally {
      // release the client back to the pool.
      client.release();
    }
  }

  public async findById(id: number): Promise<Question | null> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query("SELECT * FROM questions WHERE question_id = $1", [id]);
      return result.rows[0] ?? null;
    } catch (error) {
      console.error("Error fetching question by id:", error);
      throw new Error("Could not retrieve question by id.");
    } finally {
      client.release();
    }
  }

  public async getSolutionById(id: number): Promise<{ question_id: number; code_solution: string } | null> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT question_id, code_solution FROM questions WHERE question_id = $1",
        [id]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      console.error("Error fetching solution by id:", error);
      throw new Error("Could not retrieve question solution.");
    } finally {
      client.release();
    }
  }

  /**
   * Get IDs of questions served to a user within the recent window.
   * Requires a table `question_served(user_id TEXT, question_id INT, served_at TIMESTAMPTZ)`.
   */
  public async findRecentlyServedQuestionIds(user: string, windowDays: number): Promise<number[]> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT question_id
         FROM question_served
         WHERE user_id = $1 AND served_at >= NOW() - ($2 || ' days')::interval`,
        [user, windowDays]
      );
      return result.rows.map((r: any) => r.question_id as number);
    } catch (error) {
      console.error("Error fetching recently served question ids:", error);
      throw new Error("Could not retrieve recently served question ids.");
    } finally {
      client.release();
    }
  }

  /**
   * Select a random question matching the criteria and excluding certain IDs.
   * If tags provided, match if any overlap (tags && $array).
   */
  public async findRandomByCriteria(
    criteria: { difficulty?: Difficulty; tags?: string[]; excludeIds?: number[] }
  ): Promise<Question | null> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (criteria.difficulty) {
        params.push(criteria.difficulty);
        conditions.push(`difficulty = $${params.length}`);
      }
      if (criteria.tags && criteria.tags.length > 0) {
        params.push(criteria.tags);
        conditions.push(`tags && $${params.length}::text[]`);
      }
      if (criteria.excludeIds && criteria.excludeIds.length > 0) {
        params.push(criteria.excludeIds);
        conditions.push(`NOT (question_id = ANY($${params.length}::int[]))`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM questions ${where} ORDER BY RANDOM() LIMIT 1`;
      const result = await client.query(sql, params);
      return result.rows[0] ?? null;
    } catch (error) {
      console.error("Error selecting question by criteria:", error);
      throw new Error("Could not select question by criteria.");
    } finally {
      client.release();
    }
  }

  /**
   * Record that a question was served to a user now.
   */
  public async recordServed(user: string, questionId: number): Promise<void> {
    if (!this.pool) {
      this.pool = await getConnectionPool();
    }
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO question_served (user_id, question_id, served_at) VALUES ($1, $2, NOW())`,
        [user, questionId]
      );
    } catch (error) {
      console.error("Error recording served question:", error);
      // Non-fatal for UX; but propagate so caller can decide.
      throw new Error("Could not record served question.");
    } finally {
      client.release();
    }
  }
}

export const questionRepository = new QuestionRepository();
