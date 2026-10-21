import type { EXCLUSION_REASON_VALUES } from "@/lib/mcp/const";

/** What `search_artists` returns per artist. */
export interface ArtistSummary {
  id: string;
  name: string;
}

/** One platform link on an artist, as `get_artist` returns it. */
export interface SocialLink {
  handle: string;
  url: string;
}

/** What `get_artist` returns. */
export interface ArtistDetail {
  id: string;
  name: string;
  bio: string | null;
  spotifyId: string | null;
  deezerId: string | null;
  socialLinks: Record<string, SocialLink>;
}

/** A tool's result: text content, flagged when it is an error. */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type ExclusionReason = (typeof EXCLUSION_REASON_VALUES)[number];
export type MappingConfidence = "high" | "medium" | "low" | "manual";
export type MappingSource = "wikidata" | "musicbrainz" | "name_search" | "web_search" | "manual";

/** What `resolveArtistMapping` reports. */
export type ResolveResult = {
  created: boolean;
  updated: boolean;
  skipped: boolean;
  previousMapping?: { platformId: string; confidence: string };
};

export type ResolveItem = {
  artistId: string;
  platform: string;
  platformId: string;
  confidence: MappingConfidence;
  source: MappingSource;
  reasoning?: string;
};

export type ResolveBatchResult = ResolveResult & { artistId: string; error?: string };

export type ExcludeItem = {
  artistId: string;
  platform: string;
  reason: ExclusionReason;
  details?: string;
};

export type ExcludeBatchResult = {
  artistId: string;
  created: boolean;
  updated: boolean;
  error?: string;
};

/** One row for `mcp_audit_log`. */
export type AuditEntry = {
  artistId: string;
  field: string;
  action: "set" | "delete" | "resolve" | "exclude";
  submittedUrl?: string;
  oldValue?: string | null;
  newValue?: string | null;
  apiKeyHash: string;
};
