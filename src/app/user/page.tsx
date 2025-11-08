"use client";

import { useState } from "react";
import Cookies from "js-cookie";

export default function UserPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const payload = isRegister
      ? { action: "register", email, username, password }
      : { action: "login", email, password };

    try {
      const res = await fetch("/api/v1/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setMessage(data.message);
      // store in cookies
      // to be accessible to middle which lives at the edge
      if (!isRegister && data.token)
        Cookies.set("token", data.token, { expires: 1 });

      setEmail("");
      setPassword("");
      if (isRegister) {
        // case of successful registration
        setUsername("");
        // set tab to login
        setIsRegister(false);
      } else {
        // case of successful login
        // redirect to home
        window.location.href = "/";
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(err.message);
      } else {
        throw new Error("Unexpected error");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center bg-gray-100 px-6 py-4 border-b">
        <h1 className="font-mono text-lg font-semibold text-foreground">
          PeerPrep
        </h1>
        <div className="space-x-4 text-sm">
          <button
            onClick={() => setIsRegister(false)}
            className={`${!isRegister ? "font-semibold underline" : ""}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsRegister(true)}
            className={`${isRegister ? "font-semibold underline" : ""}`}
          >
            Sign Up
          </button>
        </div>
      </div>

      <div className="flex-grow flex items-center justify-center bg-white">
        <div className="w-full max-w-sm text-center px-6">
          <h2 className="text-2xl font-semibold mb-2">Welcome to PeerPrep</h2>
          <p className="text-gray-600 mb-6 text-sm">
            A free platform to prepare for technical interviews
            <br />
            for students, by students.
          </p>

          <form onSubmit={handleSubmit} className="text-left">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full p-2 mb-3 border rounded"
              required
            />

            {isRegister && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full p-2 mb-3 border rounded"
                required
              />
            )}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full p-2 mb-2 border rounded"
              required
            />

            <button
              type="submit"
              className="w-full bg-black text-white py-2 rounded font-semibold hover:opacity-90"
            >
              {isRegister ? "Sign Up" : "Sign In"}
            </button>
          </form>

          {message && <p className="mt-4 text-red-500 text-sm">{message}</p>}
        </div>
      </div>
    </div>
  );
}
