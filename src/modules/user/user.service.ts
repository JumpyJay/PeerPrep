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
  updateUsername,
  updatePassword,
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

    return {
      success: true,
      status: 201,
      message: "User registered",
      user: newUser,
    };
  } catch (err: unknown) {
    // handle duplicate email
    if (err instanceof DatabaseError && err.code === "23505") {
      return {
        success: false,
        status: 409,
        message: "Email already registered",
      };
    }

    // fallback for unknown errors
    return { success: false, status: 500, message: "Internal Server Error" };
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

  return {
    success: true,
    status: 200,
    message: "Login successful",
    token,
    user,
  };
}

/**
 * Fetches current user.
 */
export async function getProfile(email: string) {
  try {
    const user = await userRepository.findUserByEmail(email);

    if (!user) {
      // user not found
      return null;
    }

    return {
      username: user.username,
      email: user.email,
      created_at: user.created_at,
    };
  } catch (error) {
    console.log("error: ", error);
  }
}


/**
 * Updates username.
 */
export async function updateUsername(email: string, newUsername: string) {
  try {
    const existingUser = await userRepository.findUserByUsername(newUsername);

    // blocks if another existing user has this username
    if (existingUser && existingUser.email !== email) {
      return { success: false, status: 409, message: "Username already exists" };
    }

    const updated = await userRepository.updateUsernameByEmail(email, newUsername);
    if (!updated) {
      return { success: false, status: 404, message: "User not found" };
    }

    return { success: true, status: 200, message: "Username updated", username: newUsername };
  } catch (err) {
    if (err instanceof DatabaseError && err.code === "23505") {
      return { success: false, status: 409, message: "Username already exists" };
    }
    console.error("Error updating username:", err);
    return { success: false, status: 500, message: "Internal Server Error" };
  }
}

/**
 * Updates password.
 */
export async function updatePassword(email: string, newPassword: string) {
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await userRepository.updatePasswordByEmail(email, hashed);

    if (!updated) {
      return { success: false, status: 404, message: "User not found" };
    }

    return { success: true, status: 200, message: "Password updated successfully" };
  } catch (err) {
    console.error("Error updating password:", err);
    return { success: false, status: 500, message: "Internal Server Error" };
  }
}