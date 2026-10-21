/** The whole request's bound, as in MusicNerdWeb; running out answers 408. */
export const FUN_FACT_TIMEOUT_MS = 20_000;
/** The model call's bound within it; running out answers 408. */
export const FUN_FACT_MODEL_TIMEOUT_MS = 15_000;
/** The writer's system instruction, unchanged from MusicNerdWeb. */
export const FUN_FACT_INSTRUCTIONS =
  'You are a sharp music writer. Follow the user\'s prompt exactly. Be concrete and specific — name real songs, people, places, and dates. Keep it tight: no filler or hype phrases like "rising star", "eclectic", or "undeniable". Never fabricate or speculate; if you\'re unsure, leave it out.';
/** The sampling temperature, unchanged from MusicNerdWeb. */
export const FUN_FACT_TEMPERATURE = 0.8;
/** The kinds of fact, by path segment, each to its column of the `funfacts` prompt row. */
export const FUN_FACT_TYPES = {
  surprise: "surpriseMe",
  lore: "loreDrop",
  bts: "behindTheScenes",
  activity: "recentActivity",
} as const;
