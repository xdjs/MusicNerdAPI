import { describe, expect, it } from "vitest";
import { parseSpotifyRetryAfter } from "../parseSpotifyRetryAfter";

describe("Spotify Retry-After", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  it("honors long provider delays without capping them", () => {
    expect(parseSpotifyRetryAfter("50627", now)).toBe(now + 50_627_000);
  });
  it("accepts an HTTP date and falls back safely for absent or invalid values", () => {
    expect(parseSpotifyRetryAfter("Thu, 15 Oct 2026 13:00:00 GMT", now)).toBe(now + 3_600_000);
    for (const value of [null, "invalid", "-2", "0"])
      expect(parseSpotifyRetryAfter(value, now)).toBe(now + 60_000);
  });
});
