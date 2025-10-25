import { z } from "zod";

/**
 * --------------------------------------------
 * Matching API Input Schemas (Zod Validation)
 * --------------------------------------------
 * These schemas define the canonical payload structure
 * for the Matching API endpoints. They ensure that all
 * incoming requests are type-safe and validated before
 * entering the service layer.
 * 
 * NOTE:
 * - Legacy / snake_case keys are normalized at the API boundary
 *   (in route.ts) before being parsed here.
 * - Keep these schemas strict - they represent the source of truth.
 */

// ------------------------------------------------------
// POST /api/v1/matching
// ------------------------------------------------------
// Enqueues a new ticket for matching.
// 
// Expected canonical shape after normalization:
// {
//   userId: string,
//   difficult: "EASY" | "MEDIUM" | "HARD",
//   topics: string[],
//   skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
//   strictMode: boolean,
//   timeoutSeconds?: number
// }
// ----------------------------------------------------------
export const EnqueueSchema = z.object({
    /** Unique user identifier (required, non-empty string) */
    userId: z.string().min(1),

    /** Requested question difficulty level */
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),

    /** List of topic tags or categories */
    topics: z.array(z.string().min(1)),

    /** User's self-reported coding proficiency */
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),

    /** Whether to restrict matches to identical filters */
    strictMode: z.boolean(),

    /**
     * Optional timeout duration (in seconds)
     * Must be a positive integer <= 900 (15 minutes)
     */
    timeoutSeconds: z.number().int().positive().max(900).optional()
});

// --------------------------------------------------------------
// PATCH /api/v1/matching?action=heartbeat | try-match | cancel
// --------------------------------------------------------------
// Minimal schema used by actions that only require a ticket ID.
export const TicketIdSchema = z.object({ 
    /** Unique ticket ID (UUID v4 expected) */
    ticketId: z.string().uuid(),
});

// ---------------------------------------------------------------------
// PATCH /api/v1/matching?action=relax
// ---------------------------------------------------------------------
// Allows gradual relaxation of match constraints or timeout extension.
// ---------------------------------------------------------------------
export const RelaxSchema = z.object({
    /** Ticket ID whose parameters will be relaxed */
    ticketId: z.string().uuid(),
    /** Allow match with different difficulty */
    relaxDifficulty: z.boolean().optional(),
    /** Allow match with partially overlapping topics */
    relaxTopics: z.boolean().optional(),
    /** Allow match with different skill level */
    relaxSkill: z.boolean().optional(),
    /**
     * Extend the matching timeout window (seconds)
     * Must be an integer <= 900
     */
    extendSeconds: z.number().int().positive().max(900).optional()
});

// -----------------------------------------------------
// Alases for convenience.
// -----------------------------------------------------
// These schemas share the same shape as TicketIdSchema.
export const TryMatchSchema = TicketIdSchema;
export const HeartbeatSchema = TicketIdSchema;
export const CancelSchema = TicketIdSchema;
