// /src/modules/macthing/matching.types.ts

// --------------------------
// Matching Type Definitions
// --------------------------
// These types define the core data structures used by the
// matching service, repository, and API layer.
// All domain types are kept strict and canonnical.
// The API adapter (in route.ts) handles any legacy or
// snake_cases variations before hitting this layer.

// ------------------------
// Difficult & Skill Enums
// ------------------------
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

// ----------------------------
// Client -> API Payload Types
// ----------------------------
// Used for validation via Zod and internal service calls.

export interface EnqueueRequest {
  /** Unique user ID from session or auth token */
  userId: string;
  /** Desired problem difficulty */
  difficulty: Difficulty;
  /** List of topic tags (e.g. ["graphs", "dp"]) */
  topics: string[];
  /** Self-reported coding proficiency */
  skillLevel: SkillLevel;
  /** If true, only match with identical filters */
  strictMode: boolean;
  /** Optional timeout (in seconds) before auto-cancel */
  timeoutSeconds?: number;
}

export interface HeartbeatRequest {
  /** Ticket ID to refresh / extend */
  ticketId: string;
}

export interface CancelRequest {
  /** Ticket ID to cancel */
  ticketId: string;
}

/** Allows gradual relaxation of mathing filters (for longer waits) */
export interface RelaxRequest {
  ticketId: string;
  /** Allow match with different difficulty */
  relaxDifficulty?: boolean;
  /** Allow match with partially overlapping topics */
  relaxTopics?: boolean;
  /** Allow match with different skill level */
  relaxSkill?: boolean;
  /** Extend the timeout duration (in seconds) */
  extendSeconds?: number;
}

// --------------------
// Domain State Types
// --------------------
export type TicketStatus =
  | "QUEUED"
  | "MATCHED"
  | "CANCELLED"
  | "TIMEOUT"
  | "EXPIRED";

/** Canonical in-memory / runtime representation of a user's ticket */
export interface Ticket {
  ticketId: string;
  userId: string;
  difficulty: Difficulty;
  topics: string[];
  skillLevel: SkillLevel;
  strictMode: boolean;
  status: TicketStatus;
  /** ISO timestap when added to queue */
  enqueuedAt: string;
  /** ISO timestamp of most recent heartbeat */
  lastSeenAt: string;
  /** ISO timestamp of timeout, if any */
  timeoutAt: string | null;
}

/** Result object returned when two tickets are matched */
export interface MatchResult {
  /** Unique identifier for the matched pair (session) */
  pairId: string;
  /** Ticket A ID */
  ticketIdA: string;
  /** Ticket B ID */
  ticketIdB: string;
  /** True if both tickets required strict matching */
  strictMode: boolean;
  /** Chosen question for the session (if assigned) */
  questionId: number | null;
  sessionId: string | null;
  /** Collaboration room ID for coding (if created) */
  collaborationId: string | null;
}

// -------------------------------------
// Static constants for UI & validation
// -------------------------------------
export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
export const SKILL_LEVELS: SkillLevel[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
];

// --------------------
// Database Row Shapes
// --------------------
// Mirrors SQL column names (snake_case) for use with
// direct DB queries or an ORM. Keep consistent with schema.sql.

export interface TicketDbRow {
  ticket_id: string;
  user_id: string;
  pair_id: string | null;
  difficulty: Difficulty;
  topics: string[];
  skill_level: SkillLevel;
  strict_mode: boolean;
  status: TicketStatus;
  enqueued_at: number;
  last_seen_at: number;
  timeout_at: number | null;
  relax_topics?: boolean;
  relax_difficulty?: boolean;
  relax_skill?: boolean;
}

export interface PairDbRow {
  pair_id: string;
  ticket_id_a: string;
  ticket_id_b: string;
  matched_at: number;
  strict_mode: boolean;
  question_id: number | null;
  collaboration_id: string | null;
  session_id?: string | null;
}

// ----------------------
// Mappers: DB -> Domain
// ----------------------
// Use these helpers whenever fetching data from the DB later.
// Keeps upper layers decoupled from snake_case DB column names.

export function mapTicket(row: TicketDbRow): Ticket {
  return {
    ticketId: row.ticket_id,
    userId: row.user_id,
    difficulty: row.difficulty,
    topics: row.topics,
    skillLevel: row.skill_level,
    strictMode: row.strict_mode,
    status: row.status,
    enqueuedAt: new Date(row.enqueued_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    timeoutAt: row.timeout_at ? new Date(row.timeout_at).toISOString() : null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function pickString(
  obj: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") return v;
  }
  return null;
}

export function mapMatchResult(row: PairDbRow): MatchResult {
  const rec = isRecord(row) ? row : ({} as Record<string, unknown>);

  const sessionId =
    pickString(rec, ["session_id", "collaboration_id"]) ??
    (typeof row.collaboration_id === "string" ? row.collaboration_id : null);

  return {
    pairId: row.pair_id,
    ticketIdA: row.ticket_id_a,
    ticketIdB: row.ticket_id_b,
    strictMode: row.strict_mode,
    questionId:
      typeof row.question_id === "string" || typeof row.question_id === "number"
        ? row.question_id
        : null,
    sessionId,
    collaborationId: row.collaboration_id ?? null,
  };
}
