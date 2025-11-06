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
import { Question } from "../question/question.types";
import { normalizeDifficulty, type Difficulty } from "./matching.utils";

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
};

type EnqueueResult = { ticket: Ticket; existing: boolean};
  
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

async function safeGetAllQuestions(): Promise<Question[]> {
  if (process.env.USE_QUESTION_SERVICE !== "true") {
    return [];
  }

  try {
    // Lazy import so cloud SQL code in question.service doesn't run at module load
    const mod = await import("../question/question.service");

    // Narrowed dynamic import: check the property exists and is an object
    const qs = (mod as { questionService?: typeof questionService }).questionService;

    if (qs && typeof qs.getAllQuestions === "function") {
      const result = await qs.getAllQuestions();
      return Array.isArray(result) ? result : [];
    }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : String(e ?? "unknown error");
    console.warn(
      "[MatchingService] question service unavailable - continuing without question data:",
      message
    );
  }

  return [];
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

/**
 * Select a question that best macthes the pair's difficulty and topics.
 * Falls back gracefully if no perfect match exists.
 */
function pickQuestionForPair(
  allQs: Question[],
  difficulty: "EASY" | "MEDIUM" | "HARD",
  topics: string[]
): number | null {
  // normalize casing for easier comparison
  const diff = difficulty.charAt(0) + difficulty.slice(1).toLowerCase(); // "EASY" -> "Easy"
  const topicsLower = topics.map(t => t.toLowerCase());

  // Exact difficulty + overlappig tag
  const overlap = allQs.find(
    (q) =>
      q.difficulty === diff &&
      (q.tags ?? []).some((tag) => topicsLower.includes(tag.toLowerCase()))
  );
  if (overlap) return overlap.question_id;

  // Same difficulty (ignore topics)
  const sameDiff = allQs.find(q => q.difficulty === diff);
  if (sameDiff) return sameDiff.question_id;

  // fallback to any available question
  return allQs.length ? allQs[0].question_id : null;
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
  
  
  async enqueueWithExisting(req: EnqueueRequest): Promise<EnqueueResult> {
    const existing = await MatchingRepo.findActiveTicketByUser(req.userId);
    if (existing) return { ticket: mapTicket(existing), existing: true };

    const timeoutSeconds = req.timeoutSeconds ?? CONFIG.defaultTicketTimeoutSeconds;
    const row: TicketDbRow = await MatchingRepo.createTicket({ 
      userId: req.userId,
      difficulty: req.difficulty,
      topics: req.topics,
      skillLevel: req.skillLevel,
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

    const anchor = await MatchingRepo.loadAnchorForUpdate(ticketId);
    if (!anchor || anchor.status !== "QUEUED") return null;

    const getUserId = (r: unknown): string | null => {
      if (!isRecord(r)) return null;
      return pickString(r, ["user_id", "userId", "user"]);
    };

    const anchorUserId = getUserId(anchor);

    // ⬇️ normalize difficulty into canonical "EASY" | "MEDIUM" | "HARD"
    const rawDifficulty = isRecord(anchor) ? pickString(anchor, ["difficulty"]) : null;
    const difficulty: Difficulty | null = normalizeDifficulty(rawDifficulty);

    const topics: string[] =
      isRecord(anchor) && Array.isArray(anchor.topics) ? (anchor.topics as string[]) : [];

    // ---- STRICT MATCH PASS ------------------------------------------------
    {
      const partner = await MatchingRepo.findPartnerStrict(anchor);
      if (partner) {
        const partnerUserId = getUserId(partner);
        if (partnerUserId && partnerUserId === anchorUserId) {
          console.warn("[MatchingService] strict partner is same user, skipping");
        } else {
          const pair = await MatchingRepo.markMatched(anchor.ticket_id, partner.ticket_id);
          if (!pair) return null;

          const allQs: Question[] = await safeGetAllQuestions();

          // If pickQuestionForPair REQUIRES Difficulty (non-null), default it:
          const qid = pickQuestionForPair(allQs, (difficulty ?? "EASY") as Difficulty, topics);

          // If your pickQuestionForPair ALLOWS null, use this instead:
          // const qid = pickQuestionForPair(allQs, difficulty, topics);

          const maybeSessioned = await enrichWithSessionIfConfigured({
            ...pair,
            ...(qid != null ? { question_id: qid } : {}),
          });

          return mapMatchResult(maybeSessioned);
        }
      }
    }

    // ---- FLEXIBLE MATCH PASS ----------------------------------------------
    {
      const partner = await MatchingRepo.findPartnerFlexible(anchor);
      if (partner) {
        const partnerUserId = getUserId(partner);
        if (partnerUserId && partnerUserId === anchorUserId) {
          console.warn("[MatchingService] flexible partner is same user, skipping");
        } else {
          const pair = await MatchingRepo.markMatched(anchor.ticket_id, partner.ticket_id);
          if (!pair) return null;

          const allQs: Question[] = await safeGetAllQuestions();

          // Same note as above re: default vs null
          const qid = pickQuestionForPair(allQs, (difficulty ?? "EASY") as Difficulty, topics);
          // or: const qid = pickQuestionForPair(allQs, difficulty, topics);

          const maybeSessioned = await enrichWithSessionIfConfigured({
            ...pair,
            ...(qid != null ? { question_id: qid } : {}),
          });

          return mapMatchResult(maybeSessioned);
        }
      }
    }

    return null;
  } catch (e: unknown) {
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
  // (place these tiny helpers near the top of the file once, if not already present)
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
      const partner =
        mode === "strict"
          ? await MatchingRepo.findPartnerStrict(workingRow)
          : await MatchingRepo.findPartnerFlexible(workingRow);

      if (!partner) return null;

      const partnerUserId = getUserId(partner);
      if (partnerUserId && rowUserId && partnerUserId === rowUserId) {
        // Guard: never match a user to themselves
        return null;
      }

      const pair = await MatchingRepo.markMatched(row.ticket_id, partner.ticket_id);
      if (!pair) return null;

      const allQs: Question[] = await safeGetAllQuestions();

      // If your picker requires non-null Difficulty, default it here:
      const effDifficulty: Difficulty = (difficulty ?? "EASY") as Difficulty;
      const qid = pickQuestionForPair(allQs, effDifficulty, topics);
      // If your picker accepts null, use: const qid = pickQuestionForPair(allQs, difficulty, topics);

      const maybeSessioned = await enrichWithSessionIfConfigured({
        ...pair,
        ...(qid != null ? { question_id: qid } : {}),
      });

      return mapMatchResult(maybeSessioned);
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
