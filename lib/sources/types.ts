import type { SOURCE_TYPES } from "@/lib/sources/const";

/** One of the vault's source types. */
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * What a fetched candidate is worth. `verified`: read, and about this artist,
 * so citable. `lead`: real but unread (bot wall, paywall, JS render), shown
 * and never cited. `dead`: does not exist, dropped.
 */
export type SourceVerification = "verified" | "lead" | "dead";

/** The site tier the relevance judge is told about. */
export type SourceTier = "preferred" | "unknown" | "low-signal";
