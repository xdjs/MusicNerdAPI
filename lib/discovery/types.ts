import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";
import type { LinkPreview } from "@/lib/pages/types";

/** A missing profile found for the artist, ready to show as a card. */
export interface DiscoveredProfile {
  siteName: string;
  displayName: string;
  value: string;
  profileUrl: string;
  logoUrl: string | null;
  colorHex: string | null;
  previewImage: string | null;
  reasoning: string | null;
  /**
   * The URL was built from the artist's own name and a real page answered:
   * the weakest finding, with nothing independent behind it. The auto-build
   * passes these columns to the source search as still open, so a guess
   * never outranks a better-evidenced answer by arriving first.
   */
  provisional: boolean;
}

/** A live signal from `discoverArtistProfilesStream`. `searching`/`checked`
 *  pair per platform; `found` fires the instant a candidate clears every gate;
 *  `unreachable` names a platform that walled us off rather than answering. */
export type DiscoveryEvent =
  | { kind: "searching"; platform: ProfileDisplayColumn; displayName: string }
  | { kind: "checked"; platform: ProfileDisplayColumn; displayName: string }
  | { kind: "found"; profile: DiscoveredProfile }
  | { kind: "unreachable"; platform: ProfileDisplayColumn; displayName: string };

/** A candidate one tier proposed, not yet validated. */
export interface TierCandidate {
  tier: 1 | 2 | 3 | 4;
  platform: ProfileDisplayColumn;
  url: string;
  reasoning: string | null;
  /** Tier 3's own probe fetch, reused rather than fetched twice. */
  preview?: LinkPreview;
  /** See `DiscoveredProfile.provisional`. Only name-derived probes set it. */
  provisional?: boolean;
}

/** One (platform, handle) URL to probe. */
export interface HandleProbe {
  platform: ProfileDisplayColumn;
  handle: string;
  source: string;
  /** A handle already on the artist's row or confirmed elsewhere this run,
   *  rather than a name-derived guess. Only confirmed handles trust an
   *  og:image with no title. */
  confirmed: boolean;
}

/** A probe that found the artist. */
export interface ProbeHit {
  url: string;
  preview: LinkPreview;
}

/** Shared across one discovery run's validation. */
export interface ValidationContext {
  record: Record<string, unknown>;
  urlmapBySiteName: Map<string, UrlmapPresentationRow>;
  /** How many candidates each column has offered; bounded to a choice, not a list. */
  seen: Map<string, number>;
}

/** One discovery run's shared state, passed through the tiers. */
export interface DiscoveryRun {
  artistId: string;
  record: Record<string, unknown>;
  /** Columns still to find; each tier removes what it proposes. */
  missing: Set<ProfileDisplayColumn>;
  urlmapBySiteName: Map<string, UrlmapPresentationRow>;
  ctx: ValidationContext;
  /** Platforms that answered a probe with a wall instead of a profile. */
  walled: Set<ProfileDisplayColumn>;
  /** When the run must stop starting tiers, in epoch ms. */
  deadline: number;
  foundCount: number;
}

/** An `artist_id_mappings` row, as tier 1 reads it. */
export interface IdMappingRow {
  platform: string;
  platformId: string;
  confidence: string;
  source: string;
}
