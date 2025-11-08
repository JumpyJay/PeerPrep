"use client";

import { useState } from "react";

const partnersAvailable = [
  {
    id: 1,
    name: "Sarah Chen",
    level: 38,
    skillTags: ["Python", "Algorithms", "DP"],
    recentProblem: "2-Sum",
    difficulty: "Easy",
    joinedAt: "2 mins ago",
    avatar: "SC",
  },
  {
    id: 2,
    name: "Marcus Williams",
    level: 42,
    skillTags: ["JavaScript", "Arrays", "Strings"],
    recentProblem: "Merge K Lists",
    difficulty: "Hard",
    joinedAt: "5 mins ago",
    avatar: "MW",
  },
  {
    id: 3,
    name: "Priya Patel",
    level: 35,
    skillTags: ["Java", "Trees", "Graphs"],
    recentProblem: "Binary Search Tree",
    difficulty: "Medium",
    joinedAt: "1 min ago",
    avatar: "PP",
  },
  {
    id: 4,
    name: "James Rodriguez",
    level: 40,
    skillTags: ["C++", "Optimization", "System Design"],
    recentProblem: "Longest Substring",
    difficulty: "Medium",
    joinedAt: "3 mins ago",
    avatar: "JR",
  },
];

const recentMatches = [
  {
    id: 1,
    partner: "Emily Zhang",
    problem: "Median of Two Sorted Arrays",
    solvedAt: "Today at 3:45 PM",
    difficulty: "Hard",
    duration: "28 mins",
  },
  {
    id: 2,
    partner: "David Kim",
    problem: "Longest Common Subsequence",
    solvedAt: "Yesterday at 7:20 PM",
    difficulty: "Medium",
    duration: "45 mins",
  },
];

export function MatchmakingTab() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-500/20 text-green-400";
      case "Medium":
        return "bg-yellow-500/20 text-yellow-400";
      case "Hard":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Quick Match Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Quick Match
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select difficulty and find a partner instantly
          </p>
          <div className="flex gap-3 flex-wrap mb-6">
            {["Easy", "Medium", "Hard"].map((diff) => (
              <button
                key={diff}
                onClick={() =>
                  setSelectedDifficulty(
                    selectedDifficulty === diff ? null : diff
                  )
                }
                className={`px-4 py-2 rounded border transition-all ${
                  selectedDifficulty === diff
                    ? `${getDifficultyColor(diff)} border-current`
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
          <button className="w-full bg-primary text-primary-foreground font-medium py-3 rounded hover:opacity-90 transition-opacity">
            Find Partner Now
          </button>
        </div>

        {/* Available Partners */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Available Partners ({partnersAvailable.length})
          </h2>
          <div className="space-y-3">
            {partnersAvailable.map((partner) => (
              <div
                key={partner.id}
                className="flex items-center justify-between p-4 bg-card/50 border border-border rounded hover:border-primary/50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {partner.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {partner.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Level {partner.level} • Joined {partner.joinedAt}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {partner.skillTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-primary/20 text-primary px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {partner.recentProblem}
                  </p>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded block ${getDifficultyColor(
                      partner.difficulty
                    )}`}
                  >
                    {partner.difficulty}
                  </span>
                </div>
                <button className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  Invite
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Stats Card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-4">Your Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Problems Solved
              </span>
              <span className="font-bold text-foreground">156</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Collaborations
              </span>
              <span className="font-bold text-foreground">42</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Success Rate
              </span>
              <span className="font-bold text-green-400">87%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Session</span>
              <span className="font-bold text-foreground">32 mins</span>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-4">Recent Matches</h3>
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match.id}
                className="p-3 bg-card/50 border border-border rounded"
              >
                <p className="text-sm font-medium text-foreground">
                  {match.partner}
                </p>
                <p className="text-xs text-muted-foreground">{match.problem}</p>
                <div className="flex justify-between items-center mt-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getDifficultyColor(
                      match.difficulty
                    )}`}
                  >
                    {match.difficulty}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {match.duration}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
