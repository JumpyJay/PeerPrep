import { Pool } from "pg";
import { getConnectionPool } from "../../lib/db";
import { Question } from "./question.types";

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
}

export const questionRepository = new QuestionRepository();
