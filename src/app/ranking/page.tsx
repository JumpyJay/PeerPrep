"use client";

import { useState, useEffect, FormEvent } from "react";
// 1. Make sure Card, CardHeader, CardTitle, CardContent are imported
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// --- Data Shape ---
interface RankEntry {
  username: string;
  elo: number;
  rank: string;
  global_rank_position: number;
  wins: number;
  losses: number;
}

// --- Page Component ---
export default function RankingTestPage() {
  // --- State Management ---
  const [leaderboard, setLeaderboard] = useState<RankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchUsername, setSearchUsername] = useState("");
  const [searchedUser, setSearchedUser] = useState<RankEntry | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // --- 2. ADD NEW STATE FOR THE REFRESH BUTTON ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // --- 3. CREATE A REUSABLE FUNCTION for fetching the leaderboard ---
  const fetchLeaderboard = async () => {
    setIsLoading(true); // Show loading spinner
    setError(null);
    try {
      const res = await fetch("/api/v1/ranking/leaderboard?limit=50");
      if (!res.ok) {
        throw new Error("Failed to fetch leaderboard data.");
      }
      const data = await res.json();
      setLeaderboard(data); // Store the fetched data in our state
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsLoading(false); // Hide loading spinner
    }
  };

  // --- 4. Call fetchLeaderboard on initial page load ---
  useEffect(() => {
    fetchLeaderboard(); // Run the function
  }, []); // The empty array [] means this effect runs only once on mount

  // --- 5. Handle User Search (Unchanged) ---
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchUsername) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchedUser(null);
    try {
      const res = await fetch(`/api/v1/ranking/user/${searchUsername}`);
      if (!res.ok) {
        throw new Error(
          res.status === 404 ? "User not found." : "Search failed."
        );
      }
      const data = await res.json();
      setSearchedUser(data);
    } catch (err) {
      if (err instanceof Error) {
        setSearchError(err.message);
      } else {
        setSearchError("An unknown error occurred");
      }
    } finally {
      setIsSearching(false);
    }
  };

  // --- 6. ADD NEW FUNCTION FOR THE REFRESH BUTTON ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage("Recalculating... this may take a moment.");
    try {
      const res = await fetch("/api/v1/ranking/recalculate", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to start recalculation.");
      }
      const result = await res.json();
      setRefreshMessage(
        `Success! ${result.submissionsProcessed} submissions processed.`
      );

      // After recalculation, automatically refresh the leaderboard
      await fetchLeaderboard();
    } catch (err) {
      if (err instanceof Error) {
        setRefreshMessage(`Error: ${err.message}`);
      } else {
        setRefreshMessage("An unknown error occurred");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- 7. UI Rendering ---
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl space-y-8">
        {/* --- 8. THIS IS THE MISSING CARD --- */}
        <Card>
          <CardHeader>
            <CardTitle>Update Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Button onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh All Rankings"}
              </Button>
              <p className="text-sm text-muted-foreground">
                {refreshMessage ||
                  "Recalculate all user scores from the submissions table."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: User Search Card (Unchanged) */}
        <Card>
          <CardHeader>
            <CardTitle>Find User Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex space-x-2">
              <Input
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Enter username..."
                disabled={isSearching}
              />
              <Button type="submit" disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </form>
            {searchError && (
              <p className="mt-4 text-sm text-red-600">{searchError}</p>
            )}
            {searchedUser && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h3 className="font-semibold">{searchedUser.username}</h3>
                <p>Rank: {searchedUser.global_rank_position}</p>
                <p>Rating: {searchedUser.elo.toFixed(0)}</p>
                <p>
                  Tier: <Badge>{searchedUser.rank}</Badge>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Main Leaderboard Card (MODIFIED) */}
        <Card>
          <CardHeader>
            <CardTitle>Global Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-center">Loading leaderboard...</p>}
            {error && <p className="text-center text-red-600">{error}</p>}

            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* --- 1. ADDED THIS COLUMN --- */}
                    <TableHead className="w-[80px]">Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((user) => (
                    <TableRow key={user.username}>
                      {/* --- 2. ADDED THIS CELL --- */}
                      <TableCell className="font-medium">
                        {user.global_rank_position}
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.rank}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.elo.toFixed(0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isLoading && !error && leaderboard.length === 0 && (
              <p className="text-center pt-4 text-gray-500">
                No ranking data found. Your service might be empty.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
