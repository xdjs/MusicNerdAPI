/** Spotify's shared application cooldown; observing one never starts a request. */
export class SpotifyDeferredError extends Error {
  readonly status = 429;
  readonly latestCode = "rate_limited";
  constructor(
    readonly retryAtMs: number,
    readonly requested = false,
  ) {
    super("Spotify returned 429; retry is deferred");
    this.name = "SpotifyDeferredError";
  }
}
