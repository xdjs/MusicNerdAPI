/** Convert seconds or an HTTP date to a future instant without shortening the provider's delay. */
export function parseSpotifyRetryAfter(value: string | null, now = Date.now()): number {
  const seconds = value && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  const date = value && !/^[-+]?\d/.test(value.trim()) ? Date.parse(value) : NaN;
  const result = Number.isFinite(seconds) ? now + seconds * 1000 : date;
  return Number.isFinite(result) && result > now && result <= 8.64e15 ? result : now + 60_000;
}
