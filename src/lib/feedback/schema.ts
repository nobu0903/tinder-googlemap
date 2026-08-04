import { z } from "zod";

export const FEEDBACK_AREAS = [
  "swipe",
  "explore",
  "collection",
  "login",
  "ads",
  "other",
] as const;

export const FEEDBACK_KINDS = ["bug", "ux", "feature", "other"] as const;

export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FeedbackBodySchema = z.object({
  area: z.enum(FEEDBACK_AREAS),
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(2000),
  extra: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email().max(254).optional(),
  ),
  source: z.string().trim().max(40).optional().default("settings"),
});
