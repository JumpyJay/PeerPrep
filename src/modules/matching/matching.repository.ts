// src/modules/matching/matching.repository.ts
// Lightweight, in-memory repository so the service & API can run without a DB.
// When you add CloudSQL/Prisma, keep the same function signature & return shapes
// so the service layer remains unchanged.

import type {
    Difficulty,
    SkillLevel,
    TicketStatus,
    TicketDbRow,
    PairDbRow,
    Ticket,
} from "./matching.types";

// --------------------------
// In-memory state(DEV only)
// --------------------------
const tickets = new Map<string, TicketDbRow>();
const pairs = new Map<string, PairDbRow>();

// Simple ID helper (falls back if crypto is unavailable)
const uuid = () => 
    (globalThis.crypto?.randomUUID?.() ?? 
    `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Normalize topics (lowercase) for consistent overlap checks
function normTopics(xs: string[] | undefined | null): string[] {
    return Array.isArray(xs) ? xs.map(s => s.trim().toLowerCase()).filter(Boolean) : [];
}

function strictOverlapThresholdFor(nAnchorTopics: number): number {
    if (nAnchorTopics <= 0) return 0; // no topic constraint
    if (nAnchorTopics === 1) return 1; // need that single tag
    if (nAnchorTopics <= 3) return 2/3; // ~0.67 for 2-3 topics
    return 0.6; // 4+ topics
}

// Simple overlap (Jaccard) used in flexible scoring
function topicOverlap(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const A = new Set(a), B = new Set(b);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union: 0;
}

/**
 * Topic distance helper used by flexible matching.
 * Distance ∈ [0, 1]: 0 means perfect coverage of the anchor topics, 1 means no overlap.
 * We measure "coverage" as: fraction of anchor topics that appear in candidate.
 */
function topicDistance(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const denom = Math.max(1, a.length);
    const overlap = inter / denom; // how much of anchor topics are covered
    return 1 - overlap; // 0 = perfect match, 1 = no overlap
}

// -------------------------------------------
// Public Repository API (mock implementation)
// -------------------------------------------
// NOTE: All methods are async to match DB usage later.

/** Create a new QUEUED ticket */
export const MatchingRepo = {
    async createTicket(p: {
        userId: string;
        difficulty: Difficulty | string;
        topics: string[];
        skillLevel: SkillLevel | string;
        strictMode: boolean;
        timeoutSeconds: number;
    }): Promise<TicketDbRow> {
        const now = Date.now();
        const t: TicketDbRow = {
            ticket_id: uuid(),
            user_id: p.userId,
            difficulty: p.difficulty as Difficulty,
            topics: p.topics.map(t => t.trim().toLowerCase()),
            skill_level: p.skillLevel as SkillLevel,
            strict_mode: p.strictMode,
            status: "QUEUED",
            enqueued_at: now,
            last_seen_at: now,
            timeout_at: now + p.timeoutSeconds * 1000,
        };
        tickets.set(t.ticket_id, t);
        return t;
    },

    /** Update last_seen_at while QUEUED (keeps the ticket "alive") */
    async heartbeat(ticketId: string): Promise<TicketDbRow | null> {
        const t = tickets.get(ticketId);
        if (!t || t.status !== "QUEUED") return null;
        t.last_seen_at = Date.now()
        tickets.set(t.ticket_id, t);
        return t;
    },

    /** Cancel a ticket if it hasn't matched yet (only from QUEUED) */
    async cancel(ticketId: string): Promise<TicketDbRow | null> {
        const t = tickets.get(ticketId);
        if (!t || t.status !== "QUEUED") return null;
        t.status = "CANCELLED";
        tickets.set(t.ticket_id, t);
        return t;
    },

    /** Load the anchor ticket that is initating a match attempt */
    async loadAnchorForUpdate(ticketId: string): Promise<TicketDbRow | null> {
        return tickets.get(ticketId) ?? null;
    },

    /**
     * STRICT partner search:
     * - Same difficulty & skill level
     * - Topics: require a MINIMUM OVERLAP with the anchor's topics (Jaccard-based),
     *   not a hard superset. The required overlap threshold depends on the number
     *   of anchor topics (see strictOverapThresholdFor). If the anchor's strict_mode 
     *   is true, we bump the threshold by +0.1 (capped at 1).
     * - Excludes the same user and the same ticket.
     * - Among eligible candidates, pick the OLDEST (FIFO by enqueued_at)
     */
    async findPartnerStrict(anchor: TicketDbRow): Promise<TicketDbRow | null> {
        if (anchor.status !== "QUEUED") return null;

        const aTopics = normTopics(anchor.topics);
        let best: TicketDbRow | null = null;

        for (const cand of tickets.values()) {
            if (cand.status !== "QUEUED") continue;
            if (cand.ticket_id === anchor.ticket_id) continue; // not itself
            if (cand.user_id === anchor.user_id) continue; // avoid same user's other ticket
            if (cand.difficulty !== anchor.difficulty) continue;
            if (cand.skill_level !== anchor.skill_level) continue;

            // Strict topics rule: candidate must include all anchor topics (superset)
            const cTopics = normTopics(cand.topics);
            const overlap = topicOverlap(aTopics, cTopics); // 0..1
            const base = strictOverlapThresholdFor(aTopics.length);
            const need = anchor.strict_mode ? Math.min(1, base + 0.1) : base;
            if (overlap < need) continue;

            // FIFO: pick the OLDEST compatible by enqueued_at
            if (!best || cand.enqueued_at < best.enqueued_at) {
                best = cand;
            }
        }

        return best;
    },

    /**
     * FLEXIBLE partner search:
     * Score = 0.6 * topicDistance + 0.2 * difficultyMismatch + 0.2 * skillMismatch
     * - Lower score is better
     * - Ties broken by FIFO
     */
    async findPartnerFlexible(anchor: TicketDbRow): Promise<TicketDbRow | null> {
        if (anchor.status !== "QUEUED") return null;

        const ignoreTopics = !!anchor.relax_topics;
        const relaxDifficulty = !!anchor.relax_difficulty;
        const relaxSkill = !!anchor.relax_skill;

        const aTopics = normTopics(anchor.topics);

        // Build candidates with a score: lower is better
        // Base: 1 - topicCoverage; add small penalties with mismatches.
        const scored: Array<{ cand: TicketDbRow; score: number }> = [];

        for (const cand of tickets.values()) {
            if (cand.status !== "QUEUED") continue;
            if (cand.ticket_id === anchor.ticket_id) continue;
            if (cand.user_id === anchor.user_id) continue; // avoid matching same user's multiple tickets

            // Difficulty/skill filters (only enforce when not relaxed)
            if (!relaxDifficulty && cand.difficulty !== anchor.difficulty) continue;
            if (!relaxSkill && cand.skill_level !== anchor.skill_level) continue;

            // Topic component
            const cTopics = normTopics(cand.topics);
            const coverage = ignoreTopics ? 1 : (1 - topicDistance(aTopics, cTopics)); // 0..1
            const topicComponent = ignoreTopics ? 0.5 : (1 - coverage);

            // Small penalties if relaxed (so that exact matches tend to win)
            const diffPenalty = (relaxDifficulty && cand.difficulty !== anchor.difficulty) ? 0.2 : 0;
            const skillPenalty = (relaxSkill && cand.skill_level !== anchor.skill_level) ? 0.2 : 0;

            const score = topicComponent + diffPenalty + skillPenalty; // lower is better
            scored.push({ cand, score });
        }

        if (!scored.length) return null;

        // sort by score asc; tie-break by oldest enqueued_at (FIFO)
        scored.sort((x, y) => {
            const byScore = x.score - y.score // primary: lower score wins
            if (byScore !== 0) return byScore;
            return x.cand.enqueued_at - y.cand.enqueued_at; // tie-break: older first
        });

        return scored[0].cand ?? null;
        },

        async findPairByTicketId(ticketId: string): Promise<PairDbRow | null> {
            for (const p of pairs.values()) {
                if (p.ticket_id_a === ticketId || p.ticket_id_b === ticketId) {
                    return p;
                }
            }
            return null;
        },

        async attachSession(pairId: string, sessionId: string): Promise<PairDbRow | null> {
            const p = pairs.get(pairId);
            if (!p) return null;
            p.collaboration_id = sessionId;
            // expose bth keys if different layers read different names
            (p as any).session_id = sessionId;
            pairs.set(pairId, p);
            return p;
        },

        /**
         * Atomically mark two tickets as MATCHED and record the pair.
         * Returns the new PairDbRow, or null if either ticket is no longer QUEUED.
         */
        async markMatched(aId: string, bId: string): Promise<PairDbRow | null> {
            const a = tickets.get(aId);
            const b = tickets.get(bId);
            if (!a || !b) throw new Error("Tickets not found");
            if (a.status !== "QUEUED" || b.status !== "QUEUED") return null;
            a.status = "MATCHED";
            b.status = "MATCHED";
            tickets.set(aId, a);
            tickets.set(bId, b);

            const p: PairDbRow = {
                pair_id: uuid(),
                ticket_id_a: aId,
                ticket_id_b: bId,
                matched_at: Date.now(),
                strict_mode: a.strict_mode && b.strict_mode, // session is strict only if both sides were strict
                question_id: null,
                collaboration_id: null,
            };
            pairs.set(p.pair_id, p);
            return p;
        },

        /** Extend the timeout window while still QUEUED (keeps ticket eligible longer)
         * Optionally record which constraints were relaxed.
         */
        async relaxExtend(
        ticketId: string,
        extendSeconds: number,
        opts?: { relaxTopics?: boolean; relaxDifficulty?: boolean; relaxSkill?: boolean }
        ): Promise<TicketDbRow | null> {
        const t = tickets.get(ticketId);
        if (!t || t.status !== "QUEUED") return null;

        // Extend timeout
        const base = typeof t.timeout_at === "number" ? t.timeout_at : Date.now();
        t.timeout_at = base + extendSeconds * 1000;

        // NEW: record which aspects have been relaxed
        if (opts?.relaxTopics) t.relax_topics = true;
        if (opts?.relaxDifficulty) t.relax_difficulty = true;
        if (opts?.relaxSkill) t.relax_skill = true;

        tickets.set(t.ticket_id, t);
        return t;
        },

        async getTicket(ticketId: string): Promise<TicketDbRow | null> {
            return tickets.get(ticketId) ?? null;
        },

        async findActiveTicketByUser(userId: string): Promise<TicketDbRow | null> {
            for (const t of tickets.values()) {
                if (t.user_id === userId && t.status === "QUEUED") return t;
            }
            return null;
        },

        /**
         * Cleanup lifecycle:
         * - If heartbeat is too old -> CANCELLED
         * - If now > timeout_at -> TIMEOUT
         * Keeps queue healthy while running in-memory.
         */
        async cleanup(
            staleHeartbeatSeconds: number
        ): Promise<{ timedOut: number; expired: number }> {
            const now = Date.now();
            const staleMs = Math.max(0, staleHeartbeatSeconds * 1000);

            let timedOut = 0;
            let expired = 0;

            for (const row of tickets.values()) {
                if (row.status !== "QUEUED") continue;

                // 1) Hard timeout window passed 
                if (row.timeout_at !== null && now > row.timeout_at) {
                    row.status = "TIMEOUT";
                    tickets.set(row.ticket_id, row);
                    timedOut++;
                    continue;
                }

                // 2) Heartbeat stale beyong threshld -> consider connection dropped
                if (now - row.last_seen_at > staleMs) {
                    row.status = "EXPIRED";
                    tickets.set(row.ticket_id, row);
                    expired++;
                    continue;
                }
            }
            
            return { timedOut, expired };
        },     

        // DEV-ONLY getters (used by /api/v1/matching?dump=1)
        __getTickets(): Map<string, TicketDbRow> { return tickets; },
        __getPairs(): Map<string, PairDbRow> { return pairs; },
    };

