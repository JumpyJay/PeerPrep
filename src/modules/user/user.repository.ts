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
    RETURNING email, username, password, created_at;
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
    SELECT email, username, password, created_at
    FROM users
    WHERE email = $1;
  `;
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
}

/**
 * Find a user by username. Helper to check for duplicate usernames (username has UNIQUE constraint).
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const pool = await getConnectionPool();
  const query = `
    SELECT email, username, password, created_at
    FROM users
    WHERE username = $1;
  `;

  const result = await pool.query(query, [username]);
  return result.rows[0] || null;
}

/**
 * Update a username by email.
 */
export async function updateUsernameByEmail(email: string, newUsername: string) {
  const pool = await getConnectionPool();
  const query = `
    UPDATE users 
    SET username = $1 
    WHERE email = $2 
    RETURNING username, email, created_at
  `;
 
  // check if the username already exists
  const existingUser = await findUserByUsername(newUsername);
  if (existingUser) {
    throw new Error("Username already exists");
  }

  const result = await pool.query(query, [newUsername, email]);

  return result.rows[0] || null;
}

/**
 * Update a password by email.
 */
export async function updatePasswordByEmail(email: string, hashedPassword: string) {
  const pool = await getConnectionPool();
  const query = `
    UPDATE users 
    SET password = $1 
    WHERE email = $2
    RETURNING username, email, created_at
  `;
  
  const result = await pool.query(query, [hashedPassword, email]);

  return result.rows[0] || null;
}
