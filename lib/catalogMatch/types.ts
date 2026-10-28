export type CatalogMatchAnchor = { name: string; spotify: string | null; deezer: string | null };
export type CatalogMatchState = {
  version: 1;
  anchor: CatalogMatchAnchor;
  expiresAtMs: number;
  nextAttemptAtMs?: number;
  outcome?: string;
};
export type CatalogMatchEligibility =
  | "eligible"
  | "stale"
  | "identity_changed"
  | "user_disconnected"
  | "legacy_running"
  | "exclusion_review_required";
