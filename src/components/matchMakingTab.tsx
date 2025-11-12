"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RecentSubmissionsTab from "./recentSubmissionsTab";

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

type QueueStatus = "idle" | "queueing" | "searching" | "matched" | "error";

interface MatchmakingTabProps {
  userId?: string;
}

const difficultyOptions = ["Easy", "Medium", "Hard"];
const skillOptions = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export function MatchmakingTab({ userId }: MatchmakingTabProps) {
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<string>("Medium");
  const [skillLevel, setSkillLevel] = useState<string>("INTERMEDIATE");
  const [topicsInput, setTopicsInput] = useState<string>("Arrays, Hash Table");
  const [strictMode, setStrictMode] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [matchError, setMatchError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [existingTicket, setExistingTicket] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState(userId ?? "");

  const router = useRouter();

  useEffect(() => {
    if (userId && !userIdentifier) {
      setUserIdentifier(userId);
    }
  }, [userId, userIdentifier]);

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

  const effectiveUserId = useMemo(() => {
    return userIdentifier.trim();
  }, [userIdentifier]);

  const parseTopics = (): string[] => {
    const topics = topicsInput
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean);
    return topics.length > 0 ? topics : ["General"];
  };

  const handleFindPartner = async () => {
    if (!effectiveUserId) {
      setMatchError("Please provide your user email or ID.");
      return;
    }
    setQueueStatus("queueing");
    setStatusMessage("Creating match ticket...");
    setMatchError(null);
    setSessionId(null);
    setExistingTicket(false);

    const payload = {
      userId: effectiveUserId,
      difficulty: selectedDifficulty.toUpperCase(),
      topics: parseTopics(),
      skillLevel,
      strictMode,
    };

    try {
      const response = await fetch("/api/v1/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to enqueue ticket.");
      }

      setTicketId(body.ticket_id);
      setExistingTicket(Boolean(body.existing));
      setQueueStatus("searching");
      setStatusMessage(
        body.existing
          ? "Resumed your previous queue. Looking for a partner..."
          : "Ticket created. Searching for a suitable partner..."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start matching.";
      setMatchError(message);
      setQueueStatus("error");
    }
  };

  const handleCancelQueue = async () => {
    if (!ticketId) return;
    setStatusMessage("Cancelling ticket...");
    try {
      const response = await fetch(`/api/v1/matching/tickets/${ticketId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Unable to cancel ticket.");
      }
      setQueueStatus("idle");
      setTicketId(null);
      setStatusMessage("Ticket cancelled.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cancel failed.";
      setMatchError(message);
    }
  };

  const pollTicket = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/v1/matching/tickets/${id}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (response.status === 404) {
            setQueueStatus("error");
            setStatusMessage("Ticket expired or not found.");
            setTicketId(null);
            return;
          }
          throw new Error("Polling failed");
        }
        const data = await response.json();
        switch (data.status) {
          case "matched":
            if (data.session_id) {
              setQueueStatus("matched");
              setStatusMessage("Partner found! Redirecting to session...");
              setSessionId(data.session_id);
              setTimeout(() => {
                router.push(`/collaboration/sessions/${data.session_id}`);
              }, 1200);
            }
            break;
          case "matched_pending_session":
            setStatusMessage("Partner locked in, waiting for session...");
            break;
          case "searching":
            setQueueStatus("searching");
            setStatusMessage("Still searching...");
            break;
          case "cancelled":
          case "timeout":
          case "expired":
            setQueueStatus("error");
            setStatusMessage(`Ticket ${data.status}. Please try again.`);
            setTicketId(null);
            break;
          default:
            break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Poll failed.";
        setMatchError(message);
        setQueueStatus("error");
      }
    },
    [router]
  );

  useEffect(() => {
    if (!ticketId || queueStatus !== "searching") {
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      pollTicket(ticketId);
    };
    const interval = window.setInterval(tick, 4000);
    tick();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [ticketId, queueStatus, pollTicket]);

  const queueDisabled =
    queueStatus === "queueing" || queueStatus === "searching";

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
            Select your preferences and let us pair you up. Question selection
            and session creation happen automatically once a partner is ready.
          </p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Your email / user ID
              </label>
              <input
                type="text"
                value={userIdentifier}
                onChange={(event) => setUserIdentifier(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Topics (comma separated)
              </label>
              <input
                type="text"
                value={topicsInput}
                onChange={(event) => setTopicsInput(event.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap mb-6">
            {difficultyOptions.map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Skill level
              </label>
              <select
                value={skillLevel}
                onChange={(event) => setSkillLevel(event.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {skillOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground mt-6 md:mt-0">
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(event) => setStrictMode(event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              Strict mode (exact difficulty & topic match)
            </label>
          </div>
          <div className="space-y-2">
            <button
              disabled={queueDisabled}
              onClick={handleFindPartner}
              className="w-full bg-primary text-primary-foreground font-medium py-3 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {queueStatus === "searching"
                ? "Searching..."
                : "Find Partner Now"}
            </button>
            {ticketId && (
              <button
                onClick={handleCancelQueue}
                className="w-full border border-border text-sm text-muted-foreground py-2 rounded hover:bg-secondary/40"
              >
                Cancel Search
              </button>
            )}
          </div>
          {statusMessage && (
            <p className="mt-4 text-sm text-muted-foreground">
              {statusMessage}
            </p>
          )}
          {matchError && (
            <p className="mt-2 text-sm text-destructive">{matchError}</p>
          )}
          {sessionId && (
            <p className="mt-2 text-sm text-foreground">
              Session ready: {sessionId}
            </p>
          )}
          {existingTicket && queueStatus === "searching" && (
            <p className="mt-2 text-xs text-muted-foreground">
              You already had an active ticket; we resumed it.
            </p>
          )}
        </div>

        {/* Available Partners */}
        <RecentSubmissionsTab />
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
