/** A podcast episode's recording identity, read from its page. Never inferred from a similar title. */
export interface PodcastEpisodeIdentity {
  podcastEpisodeKey: string;
  podcastShowTitle?: string;
  podcastEpisodeTitle?: string;
}

/** What `fetchPageContent` read from one URL. */
export interface PageContent {
  podcastEpisode?: PodcastEpisodeIdentity | null;
  /** The response URL after HTTP redirects, even when the response is not readable. */
  resolvedUrl?: string;
  title: string;
  snippet?: string;
  /** The body text, capped for storage. */
  extractedText: string | null;
  ogImage?: string;
  /**
   * The HTTP status, or null when the request never completed. Load-bearing:
   * "this host does not exist" and "this host refused a bot" are opposite facts
   * about whether a URL is real (see `classifyFetchedSource`).
   */
  status: number | null;
  /**
   * Why the request never completed, when `status` is null. `dns` means the
   * hostname does not exist (a model invented it); `timeout` and `network`
   * mean a real host was slow or unreachable, which proves nothing.
   */
  failure?: "dns" | "timeout" | "network";
  /** The complete body text, for verification only: a page that names the artist past the storage cap is still about them. */
  fullText?: string;
  /** When the page says it was published (YYYY-MM-DD), or null when it does not say. */
  publishedAt?: string | null;
  /** Same-host article links, so an index page can be followed to what it indexes. */
  links?: string[];
  /** Off-host links, capped. An artist's own site states their handles only in hrefs. */
  outboundLinks?: string[];
}

/** A link unfurl: thumbnail and title. */
export interface LinkPreview {
  imageUrl: string | null;
  title: string | null;
}
