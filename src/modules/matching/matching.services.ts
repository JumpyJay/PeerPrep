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
// import { questionService } from "../question/question.service";
import { Question } from "../question/question.types";
import { EnqueueSchema } from "./matching.schema";
import { boolean } from "zod";

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
    const qs = (mod as any).questionService;

    if (qs?.getAllQuestions) {
      const result = await qs.getAllQuestions();
      return Array.isArray(result) ? result : [];
    }
  } catch (e: any) {
    console.warn(
      "[MatchingService] question service unavailable - continuing without question data:",
      e?.message ?? e
    );
  }
  return [];
}

/** Utility: after the repo returns a Pair, optionally create a collab session and attach it. */
async function enrichWithSessionIfConfigured(pair: PairDbRow): Promise<PairDbRow> {
  if (!createCollabSession) return pair;

  try {
    // Prefer user IDs; fall back to ticket IDs if your PairDbRow doesn't expose user_id_*.
    const userA = (pair as any).user_id_a ?? (pair as any).ticket_id_a;
    const userB = (pair as any).user_id_b ?? (pair as any).ticket_id_b;
    const questionId = (pair as any)?.question_id ?? null;

    const session = await createCollabSession({ userA, userB, questionId });

    // Attach session on the pair if the repo exposes such a helper.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repoAny: any = MatchingRepo as any;
    if (typeof repoAny.attachSession === "function") {
      await repoAny.attachSession(
        (pair as any).pair_id,
        session.session_id
      );
    }

    // Enrich the returned PairDbRow with both fields for flexibility:
    // - collaboration_id (what your mapper might read)
    // - session_id (what route helper might read)
    return {
      ...pair,
      collaboration_id: (session as any).session_id,
      session_id: (session as any).session_id,
    } as PairDbRow;
  } catch (err) {
    console.error("[MatchingService] collaboration session creation failed:", err);

    // If repo supports compensating action, attempt rollback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repoAny: any = MatchingRepo as any;
    if (typeof repoAny.rollbackMatch === "function") {
      try {
        await repoAny.rollbackMatch((pair as any).pair_id);
      } catch (rollbackErr) {
        console.error("[MatchingService] rollbackMatch failed:", rollbackErr);
      }
    }

    // Propagate so the API can decide to surface 500 / retry / etc.
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
      // Opportunistic housekeeping
      await MatchingRepo.cleanup(CONFIG.staleHeartbeatSeconds).catch(() => void 0);

      const anchor = await MatchingRepo.loadAnchorForUpdate(ticketId);
      if (!anchor || anchor.status !== "QUEUED") return null;

      // ---- STRICT MATCH PASS ------------------------------------------------
      {
        const partner = await MatchingRepo.findPartnerStrict(anchor);
        if (partner) {
          // Guard: never match a user to themselves
          if (
            (partner as any).user_id === (anchor as any).user_id
          ) {
            console.warn("[MatchingService] strict partner is same user, skipping");
          } else {
            const pair = await MatchingRepo.markMatched(anchor.ticket_id, partner.ticket_id);
            if (!pair) return null;
            
            const allQs: Question[] = await safeGetAllQuestions();
            const qid = pickQuestionForPair(allQs, anchor.difficulty as any, anchor.topics ?? []);

            const maybeSessioned = await enrichWithSessionIfConfigured({
              ...pair,
              ...(qid != null ? { question_id: qid } : {}),
            } as PairDbRow);

              return mapMatchResult(maybeSessioned);
            }
          }
        }

      // ---- FLEXIBLE MATCH PASS ----------------------------------------------
      {
        const partner = await MatchingRepo.findPartnerFlexible(anchor);
        if (partner) {
          if (
            (partner as any).user_id === (anchor as any).user_id
          ) {
            console.warn("[MatchingService] flexible partner is same user, skipping");
          } else {
            const pair = await MatchingRepo.markMatched(anchor.ticket_id, partner.ticket_id);
            if (!pair) return null;
            
            const allQs: Question[] = await safeGetAllQuestions();
            const qid = pickQuestionForPair(allQs, anchor.difficulty as any, anchor.topics ?? []);

            const maybeSessioned = await enrichWithSessionIfConfigured({
              ...pair,
              ...(qid != null ? { question_id: qid } : {}),
            } as PairDbRow);

            return mapMatchResult(maybeSessioned);
          }
        }
      }

      return null;
    } catch (e) {
      console.error("[MatchingService.tryMatch] failed for ticket:", ticketId, e);
      throw e; // keep bubbling so the route returns 500 for now
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
      const row = await MatchingRepo.relaxExtend(req.ticketId, extendSeconds, {
        relaxTopics: !!req.relaxTopics,
        relaxDifficulty: !!req.relaxDifficulty,
        relaxSkill: !!req.relaxSkill,
        });

      if (!row || row.status !== "QUEUED") return null;

      // If caller chose to relax TOPICS, bias immediately toward flexible search.
      // Otherwise retry strict first (possibly catching newly arrived strict partners).
      const preferFlexibleFirst = !!req.relaxTopics;

      // Helper to attempt a match and (optionally) create a session
      const attempt = async (mode: "strict" | "flex") => {
        if (mode === "strict") {
          const partner = await MatchingRepo.findPartnerStrict(row);
          if (partner) {
            // Guard
            if ((partner as any).user_id === (row as any).user_id) return null;
            const pair = await MatchingRepo.markMatched(row.ticket_id, partner.ticket_id);
            if (!pair) return null;
            const allQs: Question[] = await safeGetAllQuestions();
            const qid = pickQuestionForPair(allQs, row.difficulty as any, row.topics ?? []);

            const maybeSessioned = await enrichWithSessionIfConfigured({
              ...pair,
              ...(qid != null ? { question_id: qid } : {}),
            } as PairDbRow);
            return mapMatchResult(maybeSessioned);
          }
        } else {
          const partner = await MatchingRepo.findPartnerFlexible(row);
          if (partner) {
            // Guard
            if ((partner as any).user_id === (row as any).user_id) return null;
            const pair = await MatchingRepo.markMatched(row.ticket_id, partner.ticket_id);
            if (!pair) return null;

            const allQs: Question[] = await safeGetAllQuestions();
            const qid = pickQuestionForPair(allQs, row.difficulty as any, row.topics ?? []);

            const maybeSessioned = await enrichWithSessionIfConfigured({
              ...pair,
              ...(qid != null ? { question_id: qid } : {}),
            } as PairDbRow);

            return mapMatchResult(maybeSessioned);
          }
        }
        return null;
      };

      if (preferFlexibleFirst) {
        return (await attempt("flex")) ?? (await attempt("strict"));
      } else {
        return (await attempt("strict")) ?? (await attempt("flex"));
      }
    } catch (e) {
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
