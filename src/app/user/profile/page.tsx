"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface User {
  username: string;
  email: string;
  created_at?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/v1/user/profile", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          setError("You are not logged in or your session expired.");
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Profile fetch failed:", err);
        setError("Failed to fetch user profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">Loading...</div>
    );

  if (error)
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => (window.location.href = "/user")}
          className="bg-black text-white px-4 py-2 rounded-lg hover:opacity-80 transition"
        >
          Go to Login
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-foreground hover:opacity-80 transition">
            PeerPrep
          </Link>
          <p className="text-sm text-muted-foreground">
            Collaborative Problem Solving
          </p>
        </div>
      </header>

      {/* Profile content */}
      <div className="max-w-md mx-auto mt-8 bg-white rounded-xl p-6 shadow-lg">
        {user && (
          <div className="flex flex-col items-center space-y-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-black text-white flex items-center justify-center text-3xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>

            {/* User Details */}
            <div className="space-y-2 text-center">
              <div>
                <strong>Username:</strong> {user.username}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
              {user.created_at && (
                <div>
                  <strong>Joined:</strong>{" "}
                  {new Date(user.created_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Edit Profile Button */}
            <Link
              href="/user/profile/edit"
              className="w-full bg-black text-white py-2 rounded-lg hover:opacity-80 transition text-center"
            >
              Edit Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
