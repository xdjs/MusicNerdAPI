import type { MusicPlatform } from "@/lib/musicPlatform/types";

/** Failed provider reads are retryable, not a confirmed missing artist. */
export class ProviderSearchUnavailableError extends Error {
  constructor(platform: MusicPlatform) {
    super(
      `${platform === "spotify" ? "Spotify" : "Deezer"} artist lookup is temporarily unavailable. Please try again later.`,
    );
    this.name = "ProviderSearchUnavailableError";
  }
}
