import { describe, expect, it, vi } from "vitest";
import { storeReelTranscript } from "@/lib/social/storeReelTranscript";
import { storedReelTranscript } from "@/lib/social/storedReelTranscript";
import type { WriteDb } from "@/lib/db/db";
import { PgDialect } from "drizzle-orm/pg-core";
const task = {
  source: "reels" as const,
  handle: "artist",
  runId: "run",
  reels: [{ id: "1", owner: "artist", url: "https://www.instagram.com/p/Abc/" }],
};
const item = {
  id: "1",
  ownerUsername: "artist",
  url: "https://www.instagram.com/reel/Abc/",
  transcript: "The track was recorded in a barn.",
};
describe("trusted reel audio attachment", () => {
  it("accepts p/reel aliases for the same id/owner/shortcode and preserves caption fields", async () => {
    const execute = vi.fn().mockResolvedValue([{ id: "row" }]);
    expect(await storeReelTranscript(item, "a", task, { execute } as unknown as WriteDb)).toBe(
      true,
    );
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const strings = query.sql + JSON.stringify(query.params);
    expect(strings).toContain("_musicnerdTranscript");
    expect(strings).toContain("apify/instagram-reel-scraper");
    expect(strings).not.toContain("set caption");
  });
  it.each([
    { ...item, ownerUsername: "foreign" },
    { ...item, id: "2" },
    { ...item, url: "https://www.instagram.com/reel/Other/" },
    { ...item, url: "https://evil.test/reel/Abc/" },
    { ...item, transcript: "" },
    { ...item, error: "unavailable" },
  ])("rejects unmatched or empty output", async raw => {
    const execute = vi.fn();
    expect(await storeReelTranscript(raw, "a", task, { execute } as unknown as WriteDb)).toBe(
      false,
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it("reads bounded provenance-marked audio, never arbitrary scraper fields", () => {
    expect(storedReelTranscript({ transcript: "untrusted" })).toBeNull();
    expect(
      storedReelTranscript({ _musicnerdTranscript: { version: 1, actor: "wrong", text: "bad" } }),
    ).toBeNull();
    expect(
      storedReelTranscript({
        _musicnerdTranscript: {
          version: 1,
          actor: "apify/instagram-reel-scraper",
          text: "a".repeat(20_000),
        },
      }),
    ).toHaveLength(12_000);
  });
});
