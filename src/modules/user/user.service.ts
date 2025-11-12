import bcrypt from "bcrypt"; // password hashing
import jwt from "jsonwebtoken"; // create jwt tokens for auth
import * as userRepository from "./user.repository"; 
import { UserCredentials, UserRegister } from "./user.types";
import { DatabaseError } from "pg";

const JWT_SECRET = process.env.JWT_SECRET!;

// bundles functions for easy import 
export const userService = {
  register,
  login,
  getProfile,
};

/**
 * Handles user registration.
 */
export async function register(data: UserRegister) {
  try {
    const hashed = await bcrypt.hash(data.password, 10);
    const newUser = await userRepository.createUser({
      email: data.email,
      username: data.username,
      password: hashed,
    });

    return { success: true, status: 201, message: "User registered", user: newUser };
  } catch (err: unknown) {
    // handle duplicate email
    if (err instanceof DatabaseError && err.code === "23505") {
      return { success: false, status: 409, message: "Email already registered",
      };
    }

    // fallback for unknown errors
    return { success: false, status: 500, message: "Internal Server Error",
    };
  }
}

/**
 * Handles existing user log in. 
 */
export async function login(data: UserCredentials) {
  // checks if user exists in db using email checks
  const user = await userRepository.findUserByEmail(data.email);

  if (!user) {
    return { success: false, status: 404, message: "User not found" };
  }

  // checks if password is valid
  const valid = await bcrypt.compare(data.password, user.password);

  if (!valid) {
    return { success: false, status: 401, message: "Invalid password" };
  }

  // creates signed token 
  const token = jwt.sign({ id: user.email }, JWT_SECRET, { expiresIn: "1d" });

  return { success: true, status: 200, message: "Login successful", token, user };
}

/**
 * Fetches current user.
 */
export async function getProfile(email: string) {
  try {
    const user = await userRepository.findUserByEmail(email);

    if (!user) { // user not found
      return null;
    }

    return {
      username: user.username,
      email: user.email,
      created_at: user.created_at,
    };
  } catch (err: unknown) {
    throw new Error("Internal Server Error");
  }
}
