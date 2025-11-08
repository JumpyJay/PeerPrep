// src/modules/matching/matching.repository.ts
// Lightweight, in-memory repository so the service & API can run without a DB.
// When you add CloudSQL/Prisma, keep the same function signature & return shapes
// so the service layer remains unchanged.

import { getConnectionPool } from "@/lib/db";
import type {
    Difficulty,
    SkillLevel,
    TicketDbRow,
    PairDbRow,
    TicketStatus,
} from "./matching.types";

// Helpers
const toTimestamp = (d: Date) => d.getTime();

type TicketSqlRow = {
    ticket_id: string;
    user_id: string;
    difficulty: string;
    topics: string[] | null;
    skill_level: string;
    strict_mode: boolean;
    status: string;
    enqueued_at: string;
    last_seen_at: string;
    timeout_at: string | null;
    pair_id: string | null;
};

type PairSqlRow = {
  pair_id: string;
  ticket_id_a: string;
  ticket_id_b: string;
  matched_at: string;
  strict_mode: boolean;
  question_id: string | null;
  collaboration_id: string | null;
  session_id: string | null;
};

/**
// --------------------------
// In-memory state(DEV only)
// --------------------------
const tickets = new Map<string, TicketDbRow>();
const pairs = new Map<string, PairDbRow>();

// Simple ID helper (falls back if crypto is unavailable)
const uuid = () => 
    (globalThis.crypto?.randomUUID?.() ?? 
    `${Date.now()}-${Math.random().toString(16).slice(2)}`);
*/

// Normalize topics (lowercase) for consistent overlap checks
const normTopics = (xs: string[] | undefined | null): string[] =>
    Array.isArray(xs) ? xs.map(s => s.trim().toLowerCase()).filter(Boolean) : [];


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

/** Create a new QUEUED ticket (idempotent at service layer; DB enforces uniqueness per user) */
export const MatchingRepo = {
    async createTicket(p: {
        userId: string;
        difficulty: Difficulty | string;
        topics: string[];
        skillLevel: SkillLevel | string;
        strictMode: boolean;
        timeoutSeconds: number;
    }): Promise<TicketDbRow> {
        const pool = await getConnectionPool();
        const topics = normTopics(p.topics);

        try {
            const text = `
            insert into tickets (user_id, difficulty, topics, skill_level, strict_mode, status, timeout_at)
            values ($1, $2, $3::text[], $4, $5, 'QUEUED', now() + make_interval(secs => $6))
            returning *
            `;
            const values = [p.userId, String(p.difficulty), topics, String(p.skillLevel), !!p.strictMode, p.timeoutSeconds];

            const { rows } = await pool.query(text, values);
            const r = rows[0];

            // Map DB row -> TicketDbRow (preserve your field names/types)
            return {
                ticket_id: r.ticket_id,
                user_id: r.user_id,
                difficulty: r.difficulty,
                topics: r.topics ?? [],
                skill_level: r.skill_level,
                strict_mode: r.strict_mode,
                status: r.status,
                enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                pair_id: r.pair_id ?? null,
            };
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code; 
            // 23505 = unique_violation (our partial index ux_ticket_user_open)
            if (code === "23505") {
                // Return the existing open ticket instead of crashing
                const { rows } = await pool.query(
                    `select *
                        from tickets where user_id = $1 and status = 'QUEUED'
                        order by enqueued_at asc
                        limit 1`,
                    [p.userId]
                );

                if (rows[0]) {
                    const r = rows[0];
                    return {
                        ticket_id: r.ticket_id,
                        user_id: r.user_id,
                        difficulty: r.difficulty,
                        topics: r.topics ?? [],
                        skill_level: r.skill_level,
                        strict_mode: r.strict_mode,
                        status: r.status,
                        enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                        last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                        timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                        pair_id: r.pair_id ?? null,
                    };
                }
            }

            // return if it's not a unique-violation
            throw err;
        }
    },

    /** Update last_seen_at while QUEUED (keeps the ticket "alive") */
    async heartbeat(ticketId: string): Promise<TicketDbRow | null> {
        const pool = await getConnectionPool();
        const { rows } = await pool.query(
            `update tickets 
                set last_seen_at = now()
            where ticket_id = $1 and status = 'QUEUED'
            returning *`,
            [ticketId]
        );
        if (!rows[0]) return null;
        const r = rows[0];
        return {
            ticket_id: r.ticket_id,
            user_id: r.user_id,
            difficulty: r.difficulty,
            topics: r.topics ?? [],
            skill_level: r.skill_level,
            strict_mode: r.strict_mode,
            status: r.status,
            enqueued_at: toTimestamp(new Date(r.enqueued_at)),
            last_seen_at: toTimestamp(new Date(r.last_seen_at)),
            timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
            pair_id: r.pair_id ?? null,
        };
    },

    /** Cancel a ticket if it hasn't matched yet (only from QUEUED) */
    async cancel(ticketId: string): Promise<TicketDbRow | null> {
        const pool = await getConnectionPool();
        const { rows } = await pool.query(
            `update tickets set status = 'CANCELLED'
              where ticket_id = $1 and status = 'QUEUED'
            returning *`,
            [ticketId]
        );
        if (!rows[0]) return null;
        const r = rows[0];
        return {
            ticket_id: r.ticket_id,
            user_id: r.user_id,
            difficulty: r.difficulty,
            topics: r.topics ?? [],
            skill_level: r.skill_level,
            strict_mode: r.strict_mode,
            status: r.status,
            enqueued_at: toTimestamp(new Date(r.enqueued_at)),
            last_seen_at: toTimestamp(new Date(r.last_seen_at)),
            timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
            pair_id: r.pair_id ?? null,
        };
    },

    
    /** Relax a ticket's constraints if it hasn't matched yet (only from QUEUED) */
    /** 
    async relax(ticketId: string, relax: {
        relaxDifficulty?: boolean;
        relaxTopics?: boolean;
        relaxSkill?: boolean;
        extendSeconds?: number;
    }): Promise<TicketDbRow | null> {
        const pool = await getConnectionPool();
        

        )
    },
    */

    /** Load the anchor ticket that is initating a match attempt */
    async loadAnchor(ticketId: string): Promise<TicketDbRow | null> {
        const pool = await getConnectionPool();
        const { rows } = await pool.query(`select * from tickets where ticket_id = $1`, [ticketId]);
        if (!rows[0]) return null;
        const r = rows[0];
        return {
            ticket_id: r.ticket_id,
            user_id: r.user_id,
            difficulty: r.difficulty,
            topics: r.topics ?? [],
            skill_level: r.skill_level,
            strict_mode: r.strict_mode,
            status: r.status,
            enqueued_at: toTimestamp(new Date(r.enqueued_at)),
            last_seen_at: toTimestamp(new Date(r.last_seen_at)),
            timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
            pair_id: r.pair_id ?? null,
        }
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
        const pool = await getConnectionPool();
        const { rows } = await pool.query<TicketSqlRow>(
            `select * 
                from tickets
             where status = 'QUEUED'
               and ticket_id <> $1
               and user_id <> $2
               and difficulty = $3
               and skill_level = $4
             order by enqueued_at asc
             limit 100`, 
             [anchor.ticket_id, anchor.user_id, anchor.difficulty, anchor.skill_level]
        );

        const aTopics = normTopics(anchor.topics);
        const base = strictOverlapThresholdFor(aTopics.length);
        const need = anchor.strict_mode ? Math.min(1, base + 0.1) : base;

        let best: TicketSqlRow | null = null;
        for (const r of rows) {
            const cTopics = normTopics(r.topics ?? []);
            const overlap = topicOverlap(aTopics, cTopics);
            if (overlap < need) continue;
            if (!best) best = r;
        }
        if (!best) return null;

        return {
            ticket_id: best.ticket_id,
            user_id: best.user_id,
            difficulty: best.difficulty as Difficulty,
            topics: best.topics ?? [],
            skill_level: best.skill_level as SkillLevel,
            strict_mode: best.strict_mode,
            status: best.status as TicketStatus,
            enqueued_at: toTimestamp(new Date(best.enqueued_at)),
            last_seen_at: toTimestamp(new Date(best.last_seen_at)),
            timeout_at: best.timeout_at ? toTimestamp(new Date(best.timeout_at)) : null,
            pair_id: best.pair_id ?? null,
        };
    },

    /**
     * FLEXIBLE partner search (filter in SQL, score in JS):
     * Score = 0.6 * topicDistance + 0.2 * difficultyMismatch + 0.2 * skillMismatch
     * - Lower score is better
     * - Ties broken by FIFO
     */
    async findPartnerFlexible(anchor: TicketDbRow): Promise<TicketDbRow | null> {
        if (anchor.status !== "QUEUED") return null;

        const ignoreTopics = !!anchor.relax_topics;
        const relaxDifficulty = !!anchor.relax_difficulty;
        const relaxSkill = !!anchor.relax_skill;

        const pool = await getConnectionPool();
        const { rows } = await pool.query<TicketSqlRow>(
            `select *
                from tickets
             where status = 'QUEUED'
               and ticket_id <> $1
               and user_id <> $2
               and ($3::boolean or difficulty = $4)
               and ($5::boolean or skill_level = $6)
             order by enqueued_at asc
             limit 200`,
            [anchor.ticket_id, anchor.user_id, relaxDifficulty, anchor.difficulty, relaxSkill, anchor.skill_level]
        );

        const aTopics = normTopics(anchor.topics);
        const scored: Array<{ r: TicketSqlRow; score: number }> = [];

        for (const r of rows) {
            const cTopics = normTopics(r.topics ?? []);
            const coverage = ignoreTopics ? 1 : (1-topicDistance(aTopics, cTopics));
            const topicComponent = ignoreTopics ? 0.5 : (1 - coverage);
            const diffPenalty = relaxDifficulty && r.difficulty !== anchor.difficulty ? 0.2 : 0;
            const skillPenalty = relaxSkill && r.skill_level !== anchor.skill_level ? 0.2 : 0;
            scored.push({ r, score: topicComponent + diffPenalty + skillPenalty });
        }
        scored.sort((x, y) => x.score - y.score);

        const best = scored[0]?.r;
        if (!best) return null;

        return {
            ticket_id: best.ticket_id,
            user_id: best.user_id,
            difficulty: best.difficulty as Difficulty,
            topics: best.topics ?? [],
            skill_level: best.skill_level as SkillLevel,
            strict_mode: best.strict_mode,
            status: best.status as TicketStatus,
            enqueued_at: toTimestamp(new Date(best.enqueued_at)),
            last_seen_at: toTimestamp(new Date(best.last_seen_at)),
            timeout_at: best.timeout_at ? toTimestamp(new Date(best.timeout_at)) : null,
            pair_id: best.pair_id,
            // keep optional relax flags
            relax_topics: anchor.relax_topics,
            relax_difficulty: anchor.relax_difficulty,
            relax_skill: anchor.relax_skill,
        };
    },

        async findPairByTicketId(ticketId: string): Promise<PairDbRow | null> {
            const pool = await getConnectionPool();
            const { rows } = await pool.query(`
                select * from pairs where ticket_id_a = $1 or ticket_id_b = $1 limit 1`, 
                [ticketId]
            );
            const p = rows[0];
            if (!p) return null;
            return {
                pair_id: p.pair_id,
                ticket_id_a: p.ticket_id_a,
                ticket_id_b: p.ticket_id_b,
                matched_at: toTimestamp(new Date(p.matched_at)),
                strict_mode: p.strict_mode,
                question_id: p.question_id ?? null,
                collaboration_id: p.collaboration_id ?? null,
                session_id: p.session_id ?? null,
            };
        },

        async attachSession(pairId: string, sessionId: string): Promise<PairDbRow | null> {
            const pool = await getConnectionPool();
            const { rows } = await pool.query(`
                update pairs set collaboration_id = $2, session_id = $2 where pair_id = $1 returning *`,
                [pairId, sessionId]
            );
            const p = rows[0];
            if (!p) return null;
            return {
                pair_id: p.pair_id,
                ticket_id_a: p.ticket_id_a,
                ticket_id_b: p.ticket_id_b,
                matched_at: toTimestamp(new Date(p.matched_at)),
                strict_mode: p.strict_mode,
                question_id: p.question_id ?? null,
                collaboration_id: p.collaboration_id ?? null,
                session_id: p.session_id ?? null,
            };
        },

        /**
         * Atomically mark two tickets as MATCHED and record the pair.
         * Returns the new PairDbRow, or null if either ticket is no longer QUEUED.
         */
        async markMatched(aId: string, bId: string): Promise<PairDbRow | null> {
           const pool = await getConnectionPool();
           const client = await pool.connect();
           try {
            await client.query("begin");

            // sort ids so both transactions lock in the same order
            const [id1, id2] = [aId, bId].sort();

            // Lock both tickets; skip if either is no longer QUEUED
            const { rows: locked } = await client.query(
                `select * from tickets
                 where ticket_id in ($1, $2)
                 order by ticket_id
                 for update`,
                [id1, id2]
            );

            if (locked.length !== 2) {
                await client.query("rollback");
                return null;
            }
            const a = locked.find(r => r.ticket_id === aId);
            const b = locked.find(r => r.ticket_id === bId);
            if (!a || !b || a.status !== "QUEUED" || b.status !== "QUEUED") {
                await client.query("rollback");
                return null;
            }

            // Update both to MATCHED
            await client.query(
                `update tickets set status = 'MATCHED' where ticket_id in ($1, $2)`,
                [aId, bId]
            );

            // Create pair
            const { rows: pairRows } = await client.query(
                `insert into pairs (ticket_id_a, ticket_id_b, strict_mode)
                 values ($1, $2, $3) 
                 returning *`,
                [aId, bId, a.strict_mode && b.strict_mode]
            );

            const pair = pairRows[0];
            // back-fill pair_id to tickets 
            await client.query(
                `update tickets set pair_id = $2 where ticket_id = $1`,
                [aId, pair.pair_id]
            );
            await client.query(
                `update tickets set pair_id = $2 where ticket_id = $1`,
                [bId, pair.pair_id]
            );

            await client.query("commit");

            return {
                pair_id: pair.pair_id,
                ticket_id_a: pair.ticket_id_a,
                ticket_id_b: pair.ticket_id_b,
                matched_at: toTimestamp(new Date(pair.matched_at)),
                strict_mode: pair.strict_mode,
                question_id: pair.question_id ?? null,
                collaboration_id: pair.collaboration_id ?? null,
                session_id: pair.session_id ?? null,
            };
           } catch (e) {
            await client.query("rollback");
            throw e;
           } finally {
            client.release();
           }
        },

        /** Extend the timeout window while still QUEUED (keeps ticket eligible longer)
         * Optionally record which constraints were relaxed.
         */
        async relaxExtend(
            ticketId: string,
            extendSeconds: number,
            // _opts?: { relaxTopics?: boolean; relaxDifficulty?: boolean; relaxSkill?: boolean }
            ): Promise<TicketDbRow | null> {
            const pool = await getConnectionPool();
            // We store relax flags in columns via JSONB or separate cols; to keep things simple,
            // we'll only extend timeout and rely on the in-memory flags being computed client-side.
            const { rows } = await pool.query(
                `update tickets
                    set timeout_at = coalesce(timeout_at, now()) + make_interval(secs => $2),
                        last_seen_at = now()
                 where ticket_id = $1 and status = 'QUEUED' returning *`,
                [ticketId, extendSeconds]
            );
            const r = rows[0];
            if (!r) return null;
            return {
                ticket_id: r.ticket_id,
                user_id: r.user_id,
                difficulty: r.difficulty,
                topics: r.topics ?? [],
                skill_level: r.skill_level,
                strict_mode: r.strict_mode,
                status: r.status,
                enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                pair_id: r.pair_id ?? null,
                // relax flags aren't persisted; MatchingService already handles null-safe logic.
            } as TicketDbRow;
        },

        async getTicket(ticketId: string): Promise<TicketDbRow | null> {
            const pool = await getConnectionPool();
            const { rows } = await pool.query(
                `select * from tickets where ticket_id = $1`,
                [ticketId]
            );
            const r = rows[0];
            if (!r) return null;
            return {
                ticket_id: r.ticket_id,
                user_id: r.user_id,
                difficulty: r.difficulty,
                topics: r.topics ?? [],
                skill_level: r.skill_level,
                strict_mode: r.strict_mode,
                status: r.status,
                enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                pair_id: r.pair_id ?? null,
            };
        },

        async findActiveTicketByUser(userId: string): Promise<TicketDbRow | null> {
            const pool = await getConnectionPool();
            const { rows } = await pool.query(
                `select * from tickets
                  where user_id = $1 and status = 'QUEUED'
                  order by enqueued_at asc
                  limit 1`,
                [userId]
            );
            const r = rows[0];
            if (!r) return null;
            return {
                ticket_id: r.ticket_id,
                user_id: r.user_id,
                difficulty: r.difficulty,
                topics: r.topics ?? [],
                skill_level: r.skill_level,
                strict_mode: r.strict_mode,
                status: r.status,
                enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                pair_id: r.pair_id ?? null,
            };
        },

        /** Cancel even if already MATCHED; re-queue the partner if applicable.
         * Idempotent and deadlock-safe (locks both tickets in sorted order).
         */
        async cancelWithPartnerRecovery(
            ticketId: string,
            opts?: { partnerExtendSeconds?: number }
        ): Promise<{ cancelled: TicketDbRow | null; partnerRequeued: TicketDbRow | null }> {
            const pool = await getConnectionPool();
            const client = await pool.connect();
            const extendSecs = Math.max(0, opts?.partnerExtendSeconds ?? 180);

            const toTicket = (r: TicketSqlRow): TicketDbRow => ({
                ticket_id: r.ticket_id,
                user_id: r.user_id,
                difficulty: r.difficulty as Difficulty,
                topics: r.topics ?? [],
                skill_level: r.skill_level as SkillLevel,
                strict_mode: r.strict_mode,
                status: r.status as TicketStatus,
                enqueued_at: toTimestamp(new Date(r.enqueued_at)),
                last_seen_at: toTimestamp(new Date(r.last_seen_at)),
                timeout_at: r.timeout_at ? toTimestamp(new Date(r.timeout_at)) : null,
                pair_id: r.pair_id ?? null,
            });

            try {
                await client.query("begin");

                // 1) Lock the cancelling ticket first
                const { rows: tRows } = await client.query<TicketSqlRow>(
                `select * from tickets where ticket_id = $1 for update`,
                [ticketId]
                );
                const t = tRows[0];
                if (!t) {
                await client.query("rollback");
                return { cancelled: null, partnerRequeued: null };
                }

                // Already terminal → idempotent no-op
                if (t.status === "CANCELLED" || t.status === "TIMEOUT" || t.status === "EXPIRED" || t.status === "DONE") {
                await client.query("commit");
                return { cancelled: null, partnerRequeued: null };
                }

                // 2) Simple pre-match cancel
                if (t.status === "QUEUED") {
                const { rows: cRows } = await client.query<TicketSqlRow>(
                    `update tickets
                    set status = 'CANCELLED'
                    where ticket_id = $1 and status = 'QUEUED'
                    returning *`,
                    [ticketId]
                );
                const c = cRows[0] ?? null;
                await client.query("commit");
                return { cancelled: c ? toTicket(c) : null, partnerRequeued: null };
                }

                // 3) MATCHED: recover partner (deadlock-safe)
                if (t.status === "MATCHED") {
                const pairId = t.pair_id;

                // If no pair_id, just cancel A
                if (!pairId) {
                    const { rows: cRows } = await client.query<TicketSqlRow>(
                    `update tickets
                        set status = 'CANCELLED', pair_id = null
                    where ticket_id = $1
                    returning *`,
                    [ticketId]
                    );
                    const c = cRows[0] ?? null;
                    await client.query("commit");
                    return { cancelled: c ? toTicket(c) : null, partnerRequeued: null };
                }

                // Lock pair (harmless vs markMatched, which only locks tickets)
                const { rows: pRows } = await client.query<PairSqlRow>(
                    `select * from pairs where pair_id = $1 for update`,
                    [pairId]
                );
                const p = pRows[0] ?? null;

                // Determine partner id
                const aId = t.ticket_id;
                const bId = p ? (p.ticket_id_a === aId ? p.ticket_id_b : p.ticket_id_a) : null;

                if (!bId) {
                    const { rows: cRows } = await client.query<TicketSqlRow>(
                    `update tickets
                        set status = 'CANCELLED', pair_id = null
                    where ticket_id = $1
                    returning *`,
                    [aId]
                    );
                    const c = cRows[0] ?? null;

                    if (p) {
                    await client.query(
                        `update pairs
                            set collaboration_id = null, session_id = null
                        where pair_id = $1`,
                        [pairId]
                    );
                    }

                    await client.query("commit");
                    return { cancelled: c ? toTicket(c) : null, partnerRequeued: null };
                }

                // **Deadlock-safe**: lock both tickets in sorted order
                const [id1, id2] = [aId, bId].sort();
                const { rows: tix } = await client.query<TicketSqlRow>(
                    `select * from tickets
                    where ticket_id in ($1, $2)
                    order by ticket_id
                    for update`,
                    [id1, id2]
                );
                if (tix.length !== 2) {
                    const { rows: cRows } = await client.query<TicketSqlRow>(
                    `update tickets
                        set status = 'CANCELLED', pair_id = null
                    where ticket_id = $1
                    returning *`,
                    [aId]
                    );
                    const c = cRows[0] ?? null;

                    await client.query(
                    `update pairs
                        set collaboration_id = null, session_id = null
                        where pair_id = $1`,
                    [pairId]
                    );

                    await client.query("commit");
                    return { cancelled: c ? toTicket(c) : null, partnerRequeued: null };
                }

                const B = tix.find((r) => r.ticket_id === bId);
                // Cancel A (the caller)
                const { rows: cRows } = await client.query<TicketSqlRow>(
                    `update tickets
                    set status = 'CANCELLED', pair_id = null
                    where ticket_id = $1
                    returning *`,
                    [aId]
                );
                const cancelled = cRows[0] ?? null;

                // Re-queue B if still matched to this pair
                let partnerRequeued: TicketDbRow | null = null;
                if (B && B.status === "MATCHED" && B.pair_id === pairId) {
                    const { rows: rq } = await client.query<TicketSqlRow>(
                    `update tickets
                        set status = 'QUEUED',
                            pair_id = null,
                            last_seen_at = now(),
                            timeout_at = coalesce(timeout_at, now()) + make_interval(secs => $2)
                    where ticket_id = $1
                    returning *`,
                    [bId, extendSecs]
                    );
                    if (rq[0]) partnerRequeued = toTicket(rq[0]);
                }

                // Neuter the pair
                await client.query(
                    `update pairs
                        set collaboration_id = null, session_id = null
                    where pair_id = $1`,
                    [pairId]
                );

                await client.query("commit");
                return { cancelled: cancelled ? toTicket(cancelled) : null, partnerRequeued };
                }

                // 4) Fallback: cancel other non-terminal states
                const { rows: cRows } = await client.query<TicketSqlRow>(
                `update tickets
                    set status = 'CANCELLED', pair_id = null
                where ticket_id = $1
                returning *`,
                [ticketId]
                );
                const c = cRows[0] ?? null;
                await client.query("commit");
                return { cancelled: c ? toTicket(c) : null, partnerRequeued: null };
            } catch (e: unknown) {
                await client.query("rollback");
                throw e;
            } finally {
                client.release();
            }
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
            const pool = await getConnectionPool();

            const { rows: toExpired } = await pool.query(
                `update tickets
                    set status = 'EXPIRED'
                 where status = 'QUEUED'
                    and last_seen_at is not null
                    and now() - last_seen_at > make_interval(secs => $1)
                 returning *`,
                [staleHeartbeatSeconds]
            );

            const { rows: toTimeout } = await pool.query(
                `update tickets 
                    set status = 'TIMEOUT'
                 where status = 'QUEUED'
                    and timeout_at is not null
                    and now() > timeout_at
                 returning 1`
            );
            
            return { timedOut: toTimeout.length, expired: toExpired.length }
        },     

        // DEV-ONLY getters (used by /api/v1/matching?dump=1)
        __getTickets(): Map<string, TicketDbRow> { 
            // not meaningful for DB; return empty Map for /dump compatibility
            return new Map() 
        },
        __getPairs(): Map<string, PairDbRow> {
            return new Map(); 
        },
    };

