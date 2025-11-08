'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// --- Data Shape ---
// This interface defines the "shape" of the data we expect
// to receive from our ranking API for any user.
interface RankEntry {
  username: string;
  elo: number;
  rank: string;
  global_rank_position: number; // The user's #1, #2, etc. position
  wins: number;
  losses: number;
}

// --- Page Component ---
// This is the main function that defines the page.
export default function RankingTestPage() {
  // --- State Management ---
  // This block sets up all the pieces of data that can change on the page.

  // Holds the list of users for the global leaderboard
  const [leaderboard, setLeaderboard] = useState<RankEntry[]>([]);
  // Tracks if the leaderboard is currently being fetched (for loading spinners)
  const [isLoading, setIsLoading] = useState(true);
  // Stores any error message from fetching the leaderboard
  const [error, setError] = useState<string | null>(null);
  
  // State for the "Find User Rank" feature
  const [searchUsername, setSearchUsername] = useState(''); // The text in the search input
  const [searchedUser, setSearchedUser] = useState<RankEntry | null>(null); // The result of a successful search
  const [isSearching, setIsSearching] = useState(false); // Tracks if a search is in progress
  const [searchError, setSearchError] = useState<string | null>(null); // Stores any error from searching

  // --- 1. Fetch Global Leaderboard ---
  // This 'useEffect' hook runs once when the component first loads.
  // Its job is to fetch the data for the "Global Leaderboard" card.
  useEffect(() => {
    async function fetchLeaderboard() {
      setIsLoading(true); // Show loading spinner
      setError(null);
      try {
        // Call the API endpoint for the global leaderboard
        const res = await fetch('/api/v1/ranking/leaderboard?limit=50');
        if (!res.ok) {
          throw new Error('Failed to fetch leaderboard data.');
        }
        const data = await res.json();
        setLeaderboard(data); // Store the fetched data in our state
      } catch (err) {
        // Handle any errors during the fetch
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        setIsLoading(false); // Hide loading spinner
      }
    }

    fetchLeaderboard(); // Run the function
  }, []); // The empty array [] means this effect runs only once on mount

  // --- 2. Handle User Search ---
  // This function is called when the user clicks the "Search" button.
  // Its job is to fetch data for the "Find User Rank" card.
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault(); // Prevent the form from refreshing the page
    if (!searchUsername) return; // Don't search if the input is empty

    setIsSearching(true); // Show loading state on the button
    setSearchError(null);
    setSearchedUser(null); // Clear previous search result
    try {
      // Call the dynamic API route with the username from the input
      const res = await fetch(`/api/v1/ranking/user/${searchUsername}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'User not found.' : 'Search failed.');
      }
      const data = await res.json();
      setSearchedUser(data); // Store the found user in state
    } catch (err) {
      // Handle search errors (e.g., user not found)
      if (err instanceof Error) {
        setSearchError(err.message);
      } else {
        setSearchError('An unknown error occurred');
      }
    } finally {
      setIsSearching(false); // Stop the loading state
    }
  };

  // --- 3. UI Rendering ---
  // This is the JSX that defines what the page looks like.
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Section 1: User Search Card */}
        <Card>
          <CardHeader>
            <CardTitle>Find User Rank</CardTitle>
          </CardHeader>
          <CardContent>
            {/* The search form */}
            <form onSubmit={handleSearch} className="flex space-x-2">
              <Input
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder="Enter username..."
                disabled={isSearching}
              />
              <Button type="submit" disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {/* Show an error if the search fails */}
            {searchError && (
              <p className="mt-4 text-sm text-red-600">{searchError}</p>
            )}

            {/* Show the found user's details if search is successful */}
            {searchedUser && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h3 className="font-semibold">{searchedUser.username}</h3>
                <p>Rank: {searchedUser.global_rank_position}</p>
                <p>Rating: {searchedUser.elo.toFixed(0)}</p>
                <p>Tier: <Badge>{searchedUser.rank}</Badge></p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Main Leaderboard Card */}
        <Card>
          <CardHeader>
            <CardTitle>Global Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Show a loading message while fetching */}
            {isLoading && <p className="text-center">Loading leaderboard...</p>}
            {/* Show an error if the fetch fails */}
            {error && <p className="text-center text-red-600">{error}</p>}
            
            {/* When not loading and no error, show the table */}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Loop over the leaderboard data and create a row for each user */}
                  {leaderboard.map((user) => (
                    <TableRow key={user.username}>
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
            
            {/* Show a message if the table is empty */}
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