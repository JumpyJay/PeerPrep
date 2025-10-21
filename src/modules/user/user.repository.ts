import { getConnectionPool } from "@/lib/db";
import { User } from "./user.types";

/**
 * Insert a new user record into the database.
 */
export async function createUser(user: Omit<User, "id">): Promise<User> {
  const pool = await getConnectionPool();
  const query = `
    INSERT INTO users (email, username, password)
    VALUES ($1, $2, $3)
    RETURNING id, email, username, password, created_at;
  `;
  const values = [user.email, user.username, user.password];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Find a user by email.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const pool = await getConnectionPool();
  const query = `
    SELECT id, email, username, password, created_at
    FROM users
    WHERE email = $1;
  `;
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
}

/**
 * Find a user by ID.
 */
export async function findUserById(id: number): Promise<User | null> {
  const pool = await getConnectionPool();
  const query = `
    SELECT id, email, username, password, created_at
    FROM users
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}
