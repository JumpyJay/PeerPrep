// src/app/matching/components/FindMatchButton.tsx
"use client";

/**
 * FindMatchButton
 * - Enqueue (POST /api/v1/matching)
 * - Poll (GET /api/v1/matching/tickets/:id)
 * - Cancel (PATCH /api/v1/matching?action=cancel)
 * - Redirect to collaboration once matched
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Configurable timeout window (in ms)
const MATCH_TIMEOUT_MS = 3 * 60_000; // 3 minutes
const normEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();

// Optional UI enums (UI-facing labels, not the strict backend enums)
type Skill = "Beginner" | "Intermediate" | "Advanced";
type Diff = "Easy" | "Medium" | "Hard";

/**
 * Returns a usable email for matching without relying on auth.
 * Order: prop -> localStorage("devEmail") -> NEXT_PUBLIC_DEV_EMAIL -> random guest
 */
function useDevEmailFallback(propEmail?: string) {
    if (propEmail) return normEmail(propEmail);

    if (typeof window !== "undefined") {
        const ls = window.localStorage.getItem("devEmail");
        if (ls) return normEmail(ls);
    }

    if (process.env.NEXT_PUBLIC_DEV_EMAIL) {
        return normEmail(process.env.NEXT_PUBLIC_DEV_EMAIL);
    }

    // last resort: determinitic-ish guest for local dev
    return `guest_${Math.random().toString(36).slice(2, 7)}@example.local`;
}

/** Props supplied by the matching screen */
export type FindMatchButtonProps = {
    /** Optional: if a specific question is preselected by the UI */
    questionId: number;
    /** Optional: user's self-reported skill (UI label) */
    skillLevel?: Skill;
    /** Optional: desired difficulty (UI label) */
    difficulty?: Diff;
    /** Optional: desired topic */
    topics?: string[];
    /** Optional: pass-through CSS classes */
    className?: string;
};

// API response when an immediate match is available
type MatchImmediate = {
    status: "matched";
    session_id: string;
    pair_id?: string;
};

// API response when a ticket is queued and needs polling
type MatchQueued = {
    status: "queued";
    ticket_id: string;
};

type MatchResponse = MatchImmediate | MatchQueued;

// Ticket status returned by the polling endpoint
type TicketStatus = 
    | { status: "queued" | "searching" }
    | { status: "matched"; session_id: string; pair_id?: string }
    | { status: "cancelled" | "expired" | "timeout" | "not_found" }
    | { status: "matched_pending_session"; pair_id?: string };

export default function FindMatchButton({
    questionId,
    skillLevel,
    difficulty,
    topics,
    className,
}: FindMatchButtonProps) {
    const router = useRouter();
    const currentUserEmail = useDevEmailFallback();

    // UI state
    const [ticketId, setTicketId] = useState<string | null>(null);
    const [status, setStatus] = useState<
        "idle" | "searching" | "matched" | "timeout" | "cancelled" | "error"
        >("idle");
    const [label, setLabel] = useState("Find Match");
    const [isCancelling, setIsCancelling] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Refs for cleanup
    const abortRef = useRef<AbortController | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup: cancel polling requests if the component unmounts
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        };
    }, []);

    // Heartbeat while searching (keeps server-side presence fresh)
    useEffect(() => {
        if (status != "searching" || !ticketId) return;
        heartbeatRef.current = setInterval(() => {
            fetch(`/api/v1/matching?action=heartbeat`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId }),
            }).catch(() => {});
        }, 15_000);
        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        };
    }, [status, ticketId]);

    /** Navigate to the collaboration room for the matched session */
    const redirectToSession = (sessionId: string) => {
        setStatus("matched")
        router.push(`/collaboration/sessions/${sessionId}`);
    };

    /** 
     * Poll the ticket status until:
     * - "matched" -> return session_id
     * - "cancelled"/"expired" -> throw
     * - 3 minutes timeout -> throw
     * 
     * Uses a gentle backoff (2s, 2.5s, 3s, ... up to 4s).
     */
    const startPolling = (id: string) => {
        abortRef.current = new AbortController();

        // backoff (2s -> 4s)
        let delay = 2000;
        const startedAt = Date.now();
        const deadline = startedAt + MATCH_TIMEOUT_MS; // configurable timeout

        const schedule = () => {
            if (Date.now() > deadline || abortRef.current?.signal.aborted) {
                setStatus("timeout");
                setLabel("Match timed out");
                setErr("No match found within the timeout window.");
                return;
            }

            pollTimeoutRef.current = setTimeout(async () => {
                setLabel("Searching for match...");

                try {
                    const res = await fetch(`/api/v1/matching/tickets/${id}`, {
                        method: "GET",
                        signal: abortRef.current?.signal,
                    });
                    const data: TicketStatus = await res.json();

                    if (data.status === "matched" && "session_id" in data) {
                        redirectToSession(data.session_id);
                        return;
                    }

                    if (data.status === "matched_pending_session") {
                        // still waiting - do nothing, keep polling
                    } else if (
                        data.status === "cancelled" || 
                        data.status === "timeout" || 
                        data.status === "expired" ||
                        data.status === "not_found"
                    ) {
                        setStatus(
                            data.status === "cancelled"
                            ? "cancelled"
                            : data.status === "timeout" || data.status === "expired"
                            ? "timeout"
                            : "error"
                        );
                        setTicketId(null);
                        setLabel("Find Match");
                        return;
                    }
                } catch (e) {
                    setStatus("error");
                    setErr(e instanceof Error ? e.message : "Failed to check ticket status.");
                    return;
                } finally {
                    delay = Math.min(delay + 500, 4000); // increase delay
                }

                schedule(); // schedule next poll
            }, delay);
        };

        schedule();
};

    // Enqueue
    const onFindMatch = async () => {
        try {
            setErr(null);
            setLabel("Starting...");
            setStatus("searching")

            // POST body intentionally uses legacy keys; API adapter normalizes them
            const res = await fetch("/api/v1/matching", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: normEmail(currentUserEmail),
                    question_id: questionId,
                    skill_level: skillLevel,
                    difficulty,
                    topics: topics ?? [],
                }),
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || "Failed to start matching");
            }

            const data: MatchResponse = await res.json();

            // Case A: matched immediately
            if (data.status === "matched") {
                redirectToSession(data.session_id);
                return;
            }

            // Case B: queued -> poll for session_id
            if (data.status === "queued") {
                setTicketId(data.ticket_id);
                setLabel("Queued...");
                startPolling(data.ticket_id);
                return;
            }

            // Fallback guard: unexpected shape
            throw new Error("Unexpected response from matching API");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Unknown error");
            setLabel("Find Match");
            setStatus("error");
        }
    };

    // Cancel
    const onCancel = async () => {
        if (!ticketId || isCancelling) return;
        try {
            setIsCancelling(true);
            // stop polling immediately
            abortRef.current?.abort();
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

            const res = await fetch(`/api/v1/matching?action=cancel`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId }),
            });
            const { ok } = await res.json().catch(() => ({ ok: false }));

            setStatus(ok ? "cancelled" : "error");
            setTicketId(null);
            setLabel("Find Match");
        } catch {
            setStatus("error");
        } finally {
            setIsCancelling(false);
        }
    };

    const isSearching = status ==="searching";
    const isBusy = isSearching || isCancelling;

    // UI
    return (
        <div className={className}>
            <div className="flex items-center gap-3">
                <Button onClick={onFindMatch} disabled={isSearching}>
                    {isSearching ? "⏳ " : "🔍 "} {label}
                </Button>

                {isSearching && (
                    <Button
                      variant="secondary"
                      onClick={onCancel}
                      disabled={isCancelling}
                      >
                        {isCancelling ? "Cancelling..." : "Cancel"}
                      </Button>
                )}
            </div>

            {status === "timeout" && (
                <div className="mt-3 flex gap-3">
                    <Button
                    variant="secondary"
                    onClick={() => {
                        setErr(null);
                        setStatus("searching");
                        setLabel("Retrying...");
                        onFindMatch(); // retry with the same criteria
                    }}
                    disabled={isBusy}
                    >
                        Retry
                    </Button>

                    <Button
                       onClick={async () => {
                        try {
                            setErr(null);
                            setStatus("searching");
                            setLabel("Relaxing criteria...");

                            const res = await fetch("/api/v1/matching", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    userId: normEmail(currentUserEmail),
                                    question_id: questionId,
                                    skillLevel: skillLevel,
                                    difficulty,
                                    topics: topics ?? [],
                                    strictMode: false,
                                }),
                            });

                            if (!res.ok) throw new Error("Network error");
                            const data = await res.json();

                            if (data.status === "matched" && data.session_id) {
                                redirectToSession(data.session_id);
                                return;
                            }

                            if (data.status === "queued" && data.ticket_id) {
                                setTicketId(data.ticket_id);
                                startPolling(data.ticket_id);
                                return;
                            }

                            setStatus("error");
                            setLabel("Find Match");
                            setErr("Unexpected response from server. Please try again.");
                        } catch (e: any) {
                            setStatus("error");
                            setLabel("Find Match");
                            setErr(e?.message ?? "Failed to relax and retry.");
                        }
                       }}
                       disabled={isBusy}
                       >
                        Relax & Retry
                       </Button>
                    </div>
            )}

            {err && (
                <p className="mt-2 text-sm text-red-500" role="alert">
                    {err}
                </p>
            )}
        </div>
    );

}
