// src/modules/matching/matching.services.ts

/**
 * --------------------------
 * MatchingService
 * --------------------------
 * The orchestration layer between the API (route.ts)
 * and the data repository (matching.repository.ts)
 *
 * Responsibilities:
 *  - Apply business logic for ticket lifecycle (enqueue -> match -> relax -> cancel).
 *  - Combine strict and flexible matching strategies.
 *  - Keep the repository abstraction thin so database swaps are easy later.
 *
 * Notes:
 *  - Each method is async and returns API-safe shapes.
 *  - Repository handles raw TicketDbRow / PairDbRow,
 *    while this service maps them to domain-level objects (Ticket / MatchResult).
 */

import { MatchingRepo } from "./matching.repository";
import type {
  EnqueueRequest,
  RelaxRequest,
  Ticket,
  MatchResult,
  TicketDbRow,
  PairDbRow,
} from "./matching.types";
import { mapTicket, mapMatchResult } from "./matching.types";
import { questionService } from "../question/question.service";
import type { QuestionSelectionParams } from "../question/question.types";
import { normalizeDifficulty, type Difficulty } from "./matching.utils";
import { getProfileByEmail } from "../user/user.client";
import { SkillLevel } from "./matching.types";

/** Centralized knobs (document these in your design doc) */
const CONFIG = {
  /** Default queue timeout if caller omits it (seconds). */
  defaultTicketTimeoutSeconds: 120,
  /** Stale heartbeat threshold for housekeeping (seconds). */
  staleHeartbeatSeconds: 90,
  /**
   * Topic overlap notes:
   *  - Strict path should approximate "exact topics / high overlap".
   *  - Flexible path uses "best distance" (e.g., Jaccard) in repo.
   * Thresholds live in repo; documented here for clarity.
   */
  doc_minTopicOverlapStrict: 0.6,

  /** Grace period (seconds) to requeue partner after cancel. */
  partnerRecoveryExtendSeconds: 180,
};

type PairWithUsers = PairDbRow & { user_id_a: string; user_id_b: string };

function withUsers(pair: PairDbRow, a: string | null, b: string | null): PairWithUsers {
  // if user ids are missing, fall back to ticket ids so collab can still proceed
  const userA = a ?? pair.ticket_id_a; 
  const userB = b ?? pair.ticket_id_b;
  return { ...pair, user_id_a: userA, user_id_b: userB };
}

function explodeTopics(input: unknown): string[] {
  // Accept string or string[]
  const raw: string[] = Array.isArray(input) ? input.map(String) : (typeof input === "string" ? [input] : []);
  const out: string[] = [];
  for (const item of raw) {
    // split on commas/semicolons/pipes
    const parts = item.split(/[,\|;]+/);
    for (const p of parts) {
      const t = p.trim().toLowerCase();
      if (t) out.push(t);
    }
  }
  // de-dup
  return Array.from(new Set(out));
}

/**
 * Compute minimum topic overlap ratio (0–1) for strict matching.
 * Users with fewer topics require higher overlap.
 */
function strictOverlapThresholdFor(topicCount: number): number {
  if (topicCount <= 1) return 1.0;
  if (topicCount === 2) return 0.7;
  if (topicCount === 3) return 0.6;
  return 0.5;
}

/**
 * topicOverlap()
 * ------------------------------------------
 * Compute Jaccard similarity between two topic lists.
 * Returns a value between 0 and 1:
 *  - 1.0 → identical sets
 *  - 0.0 → no overlap
 */
function topicOverlap(a: unknown, b: unknown): number {
  const A = new Set(explodeTopics(a));
  const B = new Set(explodeTopics(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;

  let intersection = 0;
  for (const t of A) if (B.has(t)) intersection++;
  const union = new Set([...A, ...B]).size;

  return intersection / union;
}

/**
 * topicDistance()
 * ------------------------------------------
 * Convert topic overlap into a distance metric.
 * Returns 0 for identical sets and 1 for completely different sets.
 */
function topicDistance(a: unknown, b: unknown): number {
  return 1 - topicOverlap(a, b);
}


const REQUIRE_SAME_DIFFICULTY_FOR_STRICT_MIX = true; // flip to false if you don’t want this

function topicSet(a: unknown): Set<string> { return new Set(explodeTopics(a)); }

function isSameSet(a: unknown, b: unknown): boolean {
  const A = topicSet(a), B = topicSet(b);
  if (A.size !== B.size) return false;
  for (const t of A) if (!B.has(t)) return false;
  return true;
}

function isSubsetEitherWay(a: unknown, b: unknown): boolean {
  const A = topicSet(a), B = topicSet(b);
  const A_in_B = [...A].every(t => B.has(t));
  const B_in_A = [...B].every(t => A.has(t));
  return A_in_B || B_in_A;
}

function sameDifficulty(a: unknown, b: unknown): boolean {
  const A = typeof a === "string" ? normalizeDifficulty(a) : null;
  const B = typeof b === "string" ? normalizeDifficulty(b) : null;
  return !!A && !!B && A === B;
}


/**
 * Optional dependency: a function that creates collaboration sessions.
 * Injected from API layer to avoid coupling (and circular imports).
 */
type CreateSessionFn = (args: {
  userA: string;
  userB: string;
  questionId?: string | number | null;
}) => Promise<{ session_id: string }>;

let createCollabSession: CreateSessionFn | null = null;


/**
 * Allow API layer to inject a collaboration creator at runtime.
 * Example usage in route.ts:
 *   MatchingService.setCollaborationCreator(async ({ userA, userB, questionId }) => {
 *     const res = await CollaborationClient.createSession({ userA, userB, questionId });
 *     return { session_id: res.session_id };
 *   });
 */
function setCollaborationCreator(fn: CreateSessionFn | null) {
  createCollabSession = fn;
}

/** Utility: after the repo returns a Pair, optionally create a collab session and attach it. */
type CreateSessionResult = { session_id?: string; sessionId?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

async function enrichWithSessionIfConfigured(pair: PairDbRow): Promise<PairDbRow> {
  if (!createCollabSession) return pair;

  // Treat `pair` as a loose record for reading legacy keys safely.
  const rec = isRecord(pair) ? pair : ({} as Record<string, unknown>);

  try {
    // Prefer user IDs; fall back to ticket IDs if present.
    const userA = pickString(rec, ["user_id_a", "ticket_id_a"]) ?? "";
    const userB = pickString(rec, ["user_id_b", "ticket_id_b"]) ?? "";
    const questionId = (() => {
      const v = rec["question_id"];
      return typeof v === "string" || typeof v === "number" ? v : null;
    })();

    const session: CreateSessionResult = await createCollabSession({ userA, userB, questionId });
    const sessionId = session.session_id ?? session.sessionId ?? null;

    // If creation failed to return an id, just return the original pair.
    if (!sessionId) return pair;

    // If the repository exposes helpers, call them (typed optionally).
    const repo = MatchingRepo as unknown as {
      attachSession?: (pairId: string, sessionId: string) => Promise<unknown>;
      rollbackMatch?: (pairId: string) => Promise<unknown>;
    };

    const pairId = pickString(rec, ["pair_id"]);
    if (repo.attachSession && pairId) {
      await repo.attachSession(pairId, sessionId);
    }

    // Enrich the returned object with both keys for downstream readers.
    // We return a value assignable to PairDbRow; extra keys are harmless.
    const enriched = {
      ...(pair as unknown as Record<string, unknown>),
      collaboration_id: sessionId,
      session_id: sessionId, // legacy alias
    };

    return enriched as PairDbRow;
  } catch (err: unknown) {
    console.error("[MatchingService] collaboration session creation failed:", err);

    // Best-effort compensation if available
    const repo = MatchingRepo as unknown as {
      rollbackMatch?: (pairId: string) => Promise<unknown>;
    };

    const pairId = isRecord(pair) ? pickString(pair, ["pair_id"]) : null;
    if (repo.rollbackMatch && pairId) {
      try {
        await repo.rollbackMatch(pairId);
      } catch (rollbackErr) {
        console.error("[MatchingService] rollbackMatch failed:", rollbackErr);
      }
    }

    // Propagate so API can decide how to surface it
    throw err;
  }
}

async function pickQuestionForPair(args: {
  difficulty: Difficulty | null;
  topics: string[];
  users: string[];
  fallbackKey: string;
}): Promise<number | null> {
  if (process.env.USE_QUESTION_SERVICE !== "true") {
    return null;
  }

  const tags = args.topics.filter((t) => typeof t === "string" && t.trim().length > 0);
  const userIdentity =
    args.users.filter(Boolean).sort().join("|") || args.fallbackKey;

  const difficulty =
    args.difficulty !== null
      ? (args.difficulty.charAt(0) + args.difficulty.slice(1).toLowerCase()) as "Easy" | "Medium" | "Hard"
      : undefined;

  // Normalize tags to lowercase and replace spaces with hyphens to match DB format
  const normalizedTags = tags.map((tag) => tag.toLowerCase().replace(/\s+/g, "-"));

  const params: QuestionSelectionParams = {
    difficulty,
    tags: normalizedTags.length > 0 ? normalizedTags : undefined,
    user: userIdentity,
  };

  try {
    const selected = await questionService.selectQuestion(params);
    return selected?.question_id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      "[MatchingService] question selection failed; continuing without question:",
      message
    );
    return null;
  }
}

export const MatchingService = {
  /** Expose DI setter so route.ts can inject the collab creator */
  setCollaborationCreator,

  /**
   * --------------------------
   * enqueue()
   * --------------------------
   * Create a new QUEUED ticket for a user.
   *
   * - Applies a default timeout if caller did not specify one.
   * - Delegates ticket creation to MatchingRepo.
   * - Maps DB row -> API-facing Ticket type.
   */
  async enqueue(req: EnqueueRequest): Promise<Ticket> {
    const { ticket } = await MatchingService.enqueueWithExisting(req);
    return ticket;
  },
  
  async enqueueWithExisting(req: EnqueueRequest): Promise<{ ticket: Ticket; existing: boolean }> {
    const existing = await MatchingRepo.findActiveTicketByUser(req.userId);
    if (existing) return { ticket: mapTicket(existing), existing: true };

    // 1) Pull user profile (visible proof in terminal)
    try {
      const profile = await getProfileByEmail(String(req.userId));
      console.log("[MatchingService] fetched user profile:", profile);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[MatchingService] user fetch failed:", message);
      console.warn("[MatchingService] proceeding with request payload only");
    }

    // 2) Resolve effective fields (keep it simple)
    const effectiveDifficulty = normalizeDifficulty(req.difficulty ?? "EASY") ?? "EASY";
    const effectiveTopics = Array.isArray(req.topics) ? req.topics : [];
    const effectiveSkill = (req.skillLevel ?? "BEGINNER") as SkillLevel;
    const timeoutSeconds = req.timeoutSeconds ?? CONFIG.defaultTicketTimeoutSeconds;

    console.log("[MatchingService] enqueue resolved:", {
      userId: req.userId,
      difficulty: effectiveDifficulty,
      topics: effectiveTopics,
      skillLevel: effectiveSkill,
      strictMode: !!req.strictMode,
      timeoutSeconds,
    });

    const row = await MatchingRepo.createTicket({
      userId: req.userId,
      difficulty: effectiveDifficulty,
      topics: effectiveTopics,
      skillLevel: effectiveSkill,
      strictMode: req.strictMode,
      timeoutSeconds,
    });

    return { ticket: mapTicket(row), existing: false };
  },


  /**
   * ---------------------
   * heartbeat()
   * ---------------------
   * Refresh an existing QUEUED ticket's last_seen_at timestamp.
   * Keeps it alive so it isn't auto-cancelled by cleanup().
   *
   * Returns:
   *  - true -> heartbeat succeeded
   *  - false -> ticket not found or no longer QUEUED
   */
  async heartbeat(ticketId: string): Promise<boolean> {
    const row = await MatchingRepo.heartbeat(ticketId);
    return !!row;
  },

  /**
   * -----------------------
   * cancel()
   * -----------------------
   * Cancel a ticket if still QUEUED.
   *
   * Returns:
   *  - true -> successfully cancelled
   *  - false -> already matched/cancelled or not found
   */
  async cancel(ticketId: string): Promise<boolean> {
    const row = await MatchingRepo.cancel(ticketId);
    return !!row;
  },

  /**
 * -------------------------------------------
 * tryMatch()
 * -------------------------------------------
 * Attempt to find a partner for a given ticket.
 *
 * Strategy:
 *  1. Load the anchor ticket (the one initiating the match)
 *  2. Try strict matching first (exact difficulty + skill + topic coverage)
 *  3. If none found, try flexible matching (best score by distance)
 *
 * Returns:
 *  - MatchResult -> if a pair was formed
 *  - null        -> if no partner found yet
 *
 * Throws:
 *  - Error -> if repository or logic fails (bubbled up to route.ts for 500)
 */
async tryMatch(ticketId: string): Promise<MatchResult | null> {
  try {
    await MatchingRepo.cleanup(CONFIG.staleHeartbeatSeconds).catch(() => void 0);

    const anchorRow = await MatchingRepo.loadAnchor(ticketId);
    if (!anchorRow || anchorRow.status !== "QUEUED") return null;

    const getUserId = (r: unknown): string | null =>
      isRecord(r) ? pickString(r as Record<string, unknown>, ["user_id", "userId", "user"]) : null;

    const anchorUserId = getUserId(anchorRow);
    const rawDifficulty = pickString(anchorRow as unknown as Record<string, unknown>, ["difficulty"]);
    const difficulty: Difficulty | null = normalizeDifficulty(rawDifficulty);
    const topics: string[] = Array.isArray(anchorRow.topics) ? anchorRow.topics : [];

    const accepts = (a: TicketDbRow, b: TicketDbRow): boolean => {
    if (a.strict_mode) {
      // strict: same difficulty AND subset either way on topics
      if (!sameDifficulty(a.difficulty, b.difficulty)) return false;
      if (!isSubsetEitherWay(a.topics, b.topics)) return false;
      if (a.skill_level !== b.skill_level) return false; // keep skill match for strict
      return true;
    }

    // non-strict: still require same difficulty overall
    if (!sameDifficulty(a.difficulty, b.difficulty)) return false;
    return true;
  };


    // ---------- STRICT PASS ----------
    {
      const candidates = await MatchingRepo.findPartnerStrictMany(anchorRow, 10);

      for (const cand of candidates) {
        const partnerUserId = getUserId(cand);
        if (partnerUserId && anchorUserId && partnerUserId === anchorUserId) continue;

        if (!isSubsetEitherWay(anchorRow.topics, cand.topics)) continue;
        if (cand.skill_level !== anchorRow.skill_level) continue;
        if (!accepts(anchorRow, cand)) continue;

        const pair = await MatchingRepo.markMatched(anchorRow.ticket_id, cand.ticket_id);
        if (!pair) continue;

        const qid = await pickQuestionForPair({
          difficulty,
          topics,
          users: [anchorUserId ?? "", partnerUserId ?? ""].filter(Boolean),
          fallbackKey: `${anchorRow.ticket_id}|${cand.ticket_id}`,
        });

        const pairWithUsers = withUsers(pair, anchorUserId, partnerUserId);
        const maybeSessioned = await enrichWithSessionIfConfigured({
          ...pairWithUsers,
          ...(qid != null ? { question_id: qid } : {}),
        });

        return mapMatchResult(maybeSessioned);
      }
    }

    // Strict anchors don’t fall back to flex
    if (anchorRow.strict_mode) return null;

    // ---------- FLEX PASS ----------
    {
      const candidates = await MatchingRepo.findPartnerFlexibleMany(anchorRow, 20);
      const aTopics = explodeTopics(anchorRow.topics ?? []);
      const ignoreTopics = !!anchorRow.relax_topics;
      const relaxSkill = !!anchorRow.relax_skill;

      const scored = candidates
        .map((r) => {
          const cTopics = explodeTopics(r.topics ?? []);
          const coverage = ignoreTopics ? 1 : 1 - topicDistance(aTopics, cTopics);
          const topicComponent = ignoreTopics ? 0.5 : 1 - coverage;
          const skillPenalty = relaxSkill && r.skill_level !== anchorRow.skill_level ? 0.2 : 0;
          return { r, score: topicComponent + skillPenalty };
        })
        .sort((a, b) => a.score - b.score);

      for (const { r } of scored) {
        const partnerUserId = getUserId(r);
        if (partnerUserId && anchorUserId && partnerUserId === anchorUserId) continue;
        if (!accepts(anchorRow, r)) continue;

        const pair = await MatchingRepo.markMatched(anchorRow.ticket_id, r.ticket_id);
        if (!pair) continue;

        const qid = await pickQuestionForPair({
          difficulty,
          topics,
          users: [anchorUserId ?? "", partnerUserId ?? ""].filter(Boolean),
          fallbackKey: `${anchorRow.ticket_id}|${r.ticket_id}`,
        });

        const pairWithUsers = withUsers(pair, anchorUserId, partnerUserId);
        const maybeSessioned = await enrichWithSessionIfConfigured({
          ...pairWithUsers,
          ...(qid != null ? { question_id: qid } : {}),
        });

        return mapMatchResult(maybeSessioned);
      }
    }

    return null;
  } catch (e) {
    console.error("[MatchingService.tryMatch] failed for ticket:", ticketId, e);
    throw e;
  }
},



  /**
   * ------------------------------------------
   * relax()
   * ------------------------------------------
   * Gradually loosen constraints for a queued ticket.
   *
   * Behaviour:
   *  - Extends the ticket's timeout window (default +120s)
   *  - Optionally relaxes difficulty / topic / skill restrictions
   *  - Immediately attempts another match pass
   *
   * Returns:
   *  - MatchResult -> if matched after relaxation
   *  - null        -> if still unmatched
   */
async relax(req: RelaxRequest): Promise<MatchResult | null> {
  try {
    const extendSeconds = req.extendSeconds ?? CONFIG.defaultTicketTimeoutSeconds;

    // Extend timeout; keep status QUEUED if applicable
    const row = await MatchingRepo.relaxExtend(req.ticketId, extendSeconds);
    
    if (!row || row.status !== "QUEUED") return null;

    // Inject the requested relax flags into the working row (not persisted).
    const workingRow = {
      ...row,
      ...(req.relaxTopics ? { relax_topics: true as const } : {}),
      ...(req.relaxDifficulty ? { relax_difficulty: true as const } : {}),
      ...(req.relaxSkill ? { relax_skill: true as const } : {}),
    } as TicketDbRow;


    // prefer flexible search if topics relaxed; else retry strict first
    const preferFlexibleFirst = !!req.relaxTopics;

    // Precompute normalized attributes off `row`
    const rec = isRecord(workingRow) ? workingRow : ({} as Record<string, unknown>);
    const rowUserId = pickString(rec, ["user_id", "userId", "user"]);
    const rawDifficulty = pickString(rec, ["difficulty"]);
    const difficulty: Difficulty | null = normalizeDifficulty(rawDifficulty);
    const topics: string[] = Array.isArray((workingRow as unknown as { topics?: unknown }).topics)
      ? ((workingRow as unknown as { topics: string[] }).topics)
      : [];

    const getUserId = (r: unknown): string | null =>
      isRecord(r) ? pickString(r, ["user_id", "userId", "user"]) : null;

    // attempt helper (strict | flex)
    const attempt = async (mode: "strict" | "flex") => {
  if (mode === "flex" && workingRow.strict_mode) return null;

  const candidates: TicketDbRow[] =
    mode === "strict"
      ? await MatchingRepo.findPartnerStrictMany(workingRow, 10)
      : await MatchingRepo.findPartnerFlexibleMany(workingRow, 20);

  // For FLEX we can optionally re-score like tryMatch; for STRICT we use FIFO order
  const scored: Array<{ r: TicketDbRow; score: number }> =
    mode === "flex"
      ? candidates.map((r) => {
          const aTopics = explodeTopics(workingRow.topics ?? []);
          const cTopics = explodeTopics(r.topics ?? []);
          const ignoreTopics = !!workingRow.relax_topics;
          const relaxSkill = !!workingRow.relax_skill;
          const coverage = ignoreTopics ? 1 : 1 - topicDistance(aTopics, cTopics);
          const topicComponent = ignoreTopics ? 0.5 : 1 - coverage;
          const skillPenalty = relaxSkill && r.skill_level !== workingRow.skill_level ? 0.2 : 0;
          return { r, score: topicComponent + skillPenalty };
        }).sort((a, b) => a.score - b.score)
      : candidates.map((r, i) => ({ r, score: i })); // FIFO

  for (const { r: partner } of scored) {
    const partnerUserId = getUserId(partner);
    if (partnerUserId && rowUserId && partnerUserId === rowUserId) continue;

    const allowStrictMix =
      isSubsetEitherWay(workingRow.topics, partner.topics) &&
      (!REQUIRE_SAME_DIFFICULTY_FOR_STRICT_MIX ||
        sameDifficulty(workingRow.difficulty, partner.difficulty));

    if (partner.strict_mode && !workingRow.strict_mode && !allowStrictMix) continue;

    const pair = await MatchingRepo.markMatched(row.ticket_id, partner.ticket_id);
    if (!pair) continue;

    const qid = await pickQuestionForPair({
      difficulty,
      topics,
      users: [rowUserId ?? "", partnerUserId ?? ""].filter(Boolean),
      fallbackKey: `${row.ticket_id}|${partner.ticket_id}`,
    });

    const pairWithUsers = withUsers(pair, rowUserId, partnerUserId);
    const maybeSessioned = await enrichWithSessionIfConfigured({
      ...pairWithUsers,
      ...(qid != null ? { question_id: qid } : {}),
    });

    return mapMatchResult(maybeSessioned);
  }

  return null;
};

    return preferFlexibleFirst
      ? (await attempt("flex")) ?? (await attempt("strict"))
      : (await attempt("strict")) ?? (await attempt("flex"));
  } catch (e: unknown) {
    console.error("[MatchingService.relax] failed for ticket:", req.ticketId, e);
    throw e;
  }
},

  async getTicket(ticketId: string): Promise<Ticket | null> {
    const row = await MatchingRepo.getTicket(ticketId);
    return row ? mapTicket(row) : null;
  },

  /** Cancel even if already MATCHED; re-queue the partner if applicable.
   *  Returns a small payload so API can inform the UI.
   */
  async cancelRecover(ticketId: string): Promise<{
    cancelled: boolean;
    partnerRequeuedTicketId: string | null;
  }> {
    const { cancelled, partnerRequeued } =
      await MatchingRepo.cancelWithPartnerRecovery(ticketId, {
        partnerExtendSeconds: CONFIG.partnerRecoveryExtendSeconds ?? 180,
      });

    // Optional: immediately try to rematch the partner to reduce downtime.
    if (partnerRequeued?.ticket_id) {
      // Intentional fire-and-forget; swallow errors to keep DELETE fast.
      void MatchingService.tryMatch(partnerRequeued.ticket_id).catch(() => undefined);
    }

    return {
      cancelled: !!cancelled,
      partnerRequeuedTicketId: partnerRequeued?.ticket_id ?? null,
    };
  },


  /**
   * ---------------------------------
   * housekeep()
   * ---------------------------------
   * Periodic cleanup operation.
   *
   * - Cancels tickets with stale heartbeats (older than CONFIG.staleHeartbeatSeconds)
   * - Marks tickets as TIMEOUT if their timeout_at has passed
   *
   * Safe to call opportunistically (e.g. before enqueue/tryMatch).
   */
  async housekeep(): Promise<void> {
    await MatchingRepo.cleanup(CONFIG.staleHeartbeatSeconds);
  },
};
