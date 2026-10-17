import { beforeEach, describe, expect, it, vi } from "vitest";
import { planSocialResearch } from "@/lib/social/planSocialResearch";
const m = vi.hoisted(() => ({ artist: vi.fn(), limit: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/db/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.limit }) }) }),
    query: { artistSocialPosts: { findMany: m.rows } },
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.artist.mockResolvedValue({ instagram: "artist", tiktok: "@artist", x: "https://x.com/artist" });
  m.limit.mockResolvedValue([]);
  m.rows.mockResolvedValue([]);
});
describe("social research plan", () => {
  it("plans connected TikTok and X independently of an existing Instagram feed", async () => {
    expect(await planSocialResearch("a", false)).toEqual([
      { source: "tiktok", handle: "artist" },
      { source: "x", handle: "artist" },
    ]);
    expect(m.limit).not.toHaveBeenCalled();
  });
  it("does not mistake saved single posts for account coverage", async () => {
    m.limit.mockResolvedValue([{ id: "stored" }]);
    expect(await planSocialResearch("a", false)).toHaveLength(2);
    expect(await planSocialResearch("a", true)).toHaveLength(2);
  });
  it("does not enrich old Instagram identities after the artist switches accounts", async () => {
    m.rows.mockResolvedValue([
      {
        platformPostId: "1",
        ownerUsername: "oldartist",
        isOwnPost: true,
        caption: "",
        url: "https://instagram.com/reel/Abc/",
        raw: { type: "Video", productType: "clips", videoDuration: 60 },
      },
    ]);
    expect((await planSocialResearch("a", true)).map(t => t.source)).toEqual(["tiktok", "x"]);
  });
  it("propagates lookup failures rather than silently reporting disconnected sources", async () => {
    m.artist.mockResolvedValue(null);
    await expect(planSocialResearch("a", true)).rejects.toThrow("could not read social profiles");
  });
});
