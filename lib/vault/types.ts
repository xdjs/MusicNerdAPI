import type { artistVaultSources } from "@/lib/db/schema";
import type { PageContent } from "@/lib/pages/types";
import type { WebSearchResult } from "@/lib/search/types";
import type { SourceType } from "@/lib/sources/types";

/** A link resolved to a platform and a normalized handle. */
export type ResolvedHandle = {
  siteName: string;
  id: string;
  /** A release uploader may match a known account but cannot establish a new one. */
  corroborationOnly?: boolean;
};

/** A stored vault source, with the activity that added it. */
export type VaultSource = typeof artistVaultSources.$inferSelect;

/** What the pipeline writes for one source. */
export type VaultSourceInput = {
  artistId: string;
  url: string;
  title?: string;
  snippet?: string;
  type?: string;
  status?: "pending" | "approved" | "rejected";
  extractedText?: string | null;
  ogImage?: string | null;
  podcastEpisodeKey?: string | null;
  podcastShowTitle?: string | null;
  podcastEpisodeTitle?: string | null;
  /** ISO date (YYYY-MM-DD) the source says it was published, or null. */
  publishedAt?: string | null;
};

/** A search hit with the type its URL implies. The URL cannot be invented; a model's guess at the type could. */
export type DiscoveryResult = WebSearchResult & { type: SourceType };

/** A search hit and the page we fetched for it. */
export type ReadCandidate = { result: DiscoveryResult; page: PageContent; discoveredUrl?: string };

/** An account page the search returned, verified after the main pass. */
export type AccountCandidate = {
  siteName: string;
  id: string;
  url: string;
  title: string;
  description: string;
};

/** A page's outbound links, examined for ownership once the main pass is done. */
export type HubCandidate = { links: string[]; url: string; aboutArtist: boolean };

/** What a source search may be asked. */
export type SourceSearchOptions = {
  /** A durable job must retry a failure rather than finish with an empty or partial result. */
  requireComplete?: boolean;
  /** When the caller's budget ends, in epoch milliseconds. */
  deadline?: number;
  /** Columns the onboarding auto-build just filled from a discovery GUESS, so a
   *  better-evidenced answer may replace them (see `holdsAnswerFor`). */
  provisionalSiteNames?: string[];
  /** Told about each source the moment it's saved, so the research view can show
   *  it. A throw here is swallowed: reporting never costs a source. */
  onSaved?: (source: VaultSource) => void;
};

/**
 * One source search's state, passed between its steps. MusicNerdWeb kept it in
 * closures and locals inside one 800-line function.
 */
export type SearchRun = {
  artistId: string;
  artistName: string;
  /** The artist row as read at the start; passes that write links update it. */
  artist: Record<string, unknown>;
  deadline: number;
  requireComplete: boolean;
  /** Every source this run inserted, in order. */
  saved: VaultSource[];
  /** Normalized URLs already in the vault (pending, approved or rejected), plus this run's candidates. */
  existingUrls: Set<string>;
  /** Handles proven to be this artist's, by MusicBrainz, a page title or their own page. */
  verifiedHandles: Set<string>;
  /** Article links harvested from index pages, followed after the main pass. */
  indexLinks: Set<string>;
  accountCandidates: AccountCandidate[];
  hubCandidates: HubCandidate[];
  counts: { skipped: number; dropped: number; rejectedSkips: number };
  /** Columns still holding a discovery guess; a write that lands removes its column. */
  provisional: Set<string>;
  /** The caller's saved-source listener, if any. */
  onSaved?: (source: VaultSource) => void;
};

/** What `updateVaultSourceContent` may set, from a read of the source's page. */
export type VaultSourceContent = {
  title?: string;
  snippet?: string;
  extractedText?: string | null;
  ogImage?: string | null;
  podcastEpisodeKey?: string | null;
  podcastShowTitle?: string | null;
  podcastEpisodeTitle?: string | null;
  publishedAt?: string | null;
};
