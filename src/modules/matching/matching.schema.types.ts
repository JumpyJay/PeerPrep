// src/modules/matching/matching.schema.types.ts
import { z } from "zod";
import {
  EnqueueSchema,
  HeartbeatSchema,
  RelaxSchema,
  TryMatchSchema,
  CancelSchema,
} from "./matching.schema";

export type EnqueueBody   = z.infer<typeof EnqueueSchema>;
export type HeartbeatBody = z.infer<typeof HeartbeatSchema>;
export type RelaxBody     = z.infer<typeof RelaxSchema>;
export type TryMatchBody  = z.infer<typeof TryMatchSchema>;
export type CancelBody    = z.infer<typeof CancelSchema>;
