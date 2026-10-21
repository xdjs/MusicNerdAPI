import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeTransaction } from "./fakeTransaction";

const m = vi.hoisted(() => ({ tx: undefined as unknown, lock: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (t: unknown) => unknown) => fn(m.tx) },
}));
vi.mock("@/lib/artistLinkReview/lockLinkReview", () => ({ lockLinkReview: m.lock }));
const { getArtistLinkSuggestions } =
  await import("@/lib/artistLinkReview/getArtistLinkSuggestions");

const ugc = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  kind: "ugc",
  url: "https://www.instagram.com/p3t3rango/",
  title: "instagram",
  platform: "instagram",
  status: "pending",
  origin: "submission",
  submitted_at: new Date("2026-10-01T00:00:00Z"),
  user_id: "u2",
  username: "Fan",
  wallet: null,
  is_hidden: false,
  review_action: null,
  reviewed_at: null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("getArtistLinkSuggestions", () => {
  it("locks for the reviewer, then reads one page of 101 at the offset", async () => {
    const tx = fakeTransaction([[]]);
    m.tx = tx;
    expect(await getArtistLinkSuggestions("a1", "u1", 200)).toEqual({
      items: [],
      hasMore: false,
      nextOffset: null,
    });
    expect(m.lock).toHaveBeenCalledWith(tx, "a1", "u1");
    const [{ text, params }] = tx.statements();
    expect(text).toContain("from ugcresearch g where g.artist_id=$1::uuid");
    expect(text).toContain("g.site_name is distinct from 'ugc_discord_ping'");
    expect(text).toContain("s.file_path is null and s.podcast_episode_key is null");
    expect(text).toContain("order by (s.status='pending') desc,s.submitted_at desc,s.id limit $");
    expect(params.slice(-2)).toEqual([101, 200]);
  });

  it("projects a suggestion with display names only", async () => {
    m.tx = fakeTransaction([
      [
        ugc({
          status: "approved",
          reviewed_at: "2026-10-02 00:00:00+00",
          reviewer_id: "u1",
          reviewer_name: "Pete",
          reviewer_wallet: "0x1",
          reviewer_hidden: false,
          review_action: "link_approved",
        }),
      ],
    ]);
    const { items } = await getArtistLinkSuggestions("a1", "u1");
    expect(items).toEqual([
      {
        id: "g1",
        kind: "ugc",
        url: "https://www.instagram.com/p3t3rango/",
        title: "instagram",
        platform: "instagram",
        hidden: false,
        status: "approved",
        origin: "submission",
        submittedAt: "2026-10-01T00:00:00.000Z",
        suggestedBy: { id: "u2", name: "Fan" },
        reviewedAt: "2026-10-02T00:00:00.000Z",
        reviewedBy: { id: "u1", name: "Pete" },
      },
    ]);
  });

  it("names research and hides hidden or unknown people", async () => {
    m.tx = fakeTransaction([
      [
        ugc({ id: "r", origin: "research", user_id: null }),
        ugc({ id: "h", is_hidden: true }),
        ugc({
          id: "n",
          user_id: null,
          reviewed_at: new Date(0),
          reviewer_id: "x",
          reviewer_hidden: true,
        }),
      ],
    ]);
    const { items } = await getArtistLinkSuggestions("a1", "u1");
    expect(items.map(i => i.suggestedBy)).toEqual([
      { id: null, name: "Automated research" },
      { id: null, name: "Not recorded" },
      { id: null, name: "Not recorded" },
    ]);
    expect(items[2].reviewedBy).toEqual({ id: null, name: "Not recorded" });
  });

  it("drops songs, albums and sources that aren't artist destinations; labels sources from the URL", async () => {
    m.tx = fakeTransaction([
      [
        ugc({ id: "rel", url: "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy" }),
        ugc({ id: "empty", url: null }),
        ugc({
          id: "art",
          kind: "source",
          url: "https://news.test/a",
          type: "article",
          platform: null,
          title: null,
        }),
        ugc({
          id: "am",
          kind: "source",
          url: "https://music.apple.com/us/artist/pete/123",
          type: "profile",
          platform: null,
          title: null,
          review_action: "link_hidden",
        }),
      ],
    ]);
    const { items } = await getArtistLinkSuggestions("a1", "u1");
    expect(items.map(i => [i.id, i.title, i.platform, i.hidden])).toEqual([
      ["am", "Apple Music", "apple_music", true],
    ]);
  });

  it("reports another page from the 101st row", async () => {
    m.tx = fakeTransaction([Array.from({ length: 101 }, (_, i) => ugc({ id: `g${i}` }))]);
    const page = await getArtistLinkSuggestions("a1", "u1", 100);
    expect(page.items).toHaveLength(100);
    expect(page).toMatchObject({ hasMore: true, nextOffset: 200 });
  });

  it("refuses an out-of-range offset before touching the database", async () => {
    await expect(getArtistLinkSuggestions("a1", "u1", -1)).rejects.toThrow("Invalid page offset");
    await expect(getArtistLinkSuggestions("a1", "u1", 100001)).rejects.toThrow(
      "Invalid page offset",
    );
    expect(m.lock).not.toHaveBeenCalled();
  });
});
