"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface User {
  username: string;
  email: string;
  created_at?: string;
  elo: number;
  ranking: string | null;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  winRate: number;
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
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold text-foreground hover:opacity-80 transition"
          >
            PeerPrep
          </Link>
          <p className="text-sm text-muted-foreground">
            Collaborative Problem Solving
          </p>
        </div>
      </header>

      {/* Profile content */}
      <div className="max-w-3xl mx-auto mt-8 bg-white rounded-xl p-4 shadow-lg">
        {user && (
          <div className="flex flex-col items-center space-y-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center text-2xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>

            {/* Two column container */}
            <div className="flex w-full space-x-6 py-4">
              {/* User Info */}
              <div className="flex-1 space-y-1 text-left">
                <h3 className="font-bold text-lg">Personal</h3>
                <div>
                  <strong>Username:</strong> {user.username}
                </div>
                <div>
                  <strong>Email:</strong> {user.email}
                </div>
                {user.created_at && (
                  <div>
                    <strong>Joined:</strong>{" "}
                    {new Date(user.created_at).toLocaleDateString(
                      "en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px bg-gray-300" />

              {/* Ranking Info */}
              <div className="flex-1 space-y-1 text-left">
                <h3 className="font-bold text-lg">Ranking</h3>
                <div>
                  <strong>Rank:</strong> {user.ranking || "Unranked"}
                </div>
                <div>
                  <strong>ELO rating:</strong> {user.elo || 0}
                </div>
                <div>
                  <strong>Wins:</strong> {user.wins || 0}
                </div>
                <div>
                  <strong>Losses:</strong> {user.losses || 0}
                </div>
                <div>
                  <strong>Draws:</strong> {user.draws || 0}
                </div>
                <div>
                  <strong>Total Number of Submissions:</strong>{" "}
                  {user.totalMatches || 0}
                </div>
                <div>
                  <strong>Win Rate:</strong> {user.winRate || 0}%
                </div>
              </div>
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
