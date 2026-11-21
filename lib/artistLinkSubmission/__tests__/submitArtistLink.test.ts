import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import type { ArtistRow } from "@/lib/artists/types";

const m = vi.hoisted(() => ({
  extract: vi.fn(),
  user: vi.fn(),
  findFirst: vi.fn(),
  returning: vi.fn(),
  values: vi.fn(),
  approve: vi.fn(async () => {}),
  ping: vi.fn(async () => {}),
  notify: vi.fn(async () => {}),
  suggest: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({
  db: {
    query: { ugcresearch: { findFirst: m.findFirst } },
    insert: () => ({ values: (v: unknown) => (m.values(v), { returning: m.returning }) }),
    transaction: async (fn: (tx: unknown) => unknown) => fn("tx"),
  },
}));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extract }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: m.user }));
vi.mock("@/lib/artistLinkReview/approveUGC", () => ({ approveUGC: m.approve }));
vi.mock("@/lib/ugc/maybePingDiscordForPendingUGC", () => ({
  maybePingDiscordForPendingUGC: m.ping,
}));
vi.mock("@/lib/directEditLink/notifyDiscordOfArtistLinkAdded", () => ({
  notifyDiscordOfArtistLinkAdded: m.notify,
}));
vi.mock("@/lib/artistLinkSubmission/suggestArtistDestination", () => ({
  suggestArtistDestination: m.suggest,
}));
const { submitArtistLink } = await import("@/lib/artistLinkSubmission/submitArtistLink");

const artist = { id: "a1", name: "Pete Rango", instagram: null } as unknown as ArtistRow;
const url = "https://www.instagram.com/p3t3rango/";
const user = { id: "u1", username: "pete", isAdmin: false, isWhiteListed: false };

beforeEach(() => {
  vi.clearAllMocks();
  m.extract.mockResolvedValue({
    siteName: "instagram",
    cardPlatformName: "Instagram",
    id: "p3t3rango",
  });
  m.user.mockResolvedValue(user);
  m.findFirst.mockResolvedValue(undefined);
  m.returning.mockResolvedValue([{ id: "g1", createdAt: "2026-10-28 12:00:00" }]);
});

describe("submitArtistLink", () => {
  it("files a regular user's link for review and pings the admins", async () => {
    expect(await submitArtistLink(artist, "u1", url)).toEqual({
      approved: false,
      siteName: "instagram",
      platformName: "Instagram",
      message: "Thanks for adding, we'll review this addition before posting",
    });
    expect(m.values).toHaveBeenCalledWith({
      ugcUrl: url,
      origin: "submission",
      siteName: "instagram",
      siteUsername: "p3t3rango",
      artistId: "a1",
      name: "Pete Rango",
      userId: "u1",
      accepted: false,
    });
    expect(m.approve).not.toHaveBeenCalled();
    expect(m.ping).toHaveBeenCalledOnce();
    expect(m.notify).toHaveBeenCalledWith({
      user,
      artistName: "Pete Rango",
      platformName: "Instagram",
      platformId: "p3t3rango",
      submittedUrl: url,
      createdAt: "2026-10-28 12:00:00",
    });
  });

  it.each([{ isAdmin: true }, { isWhiteListed: true }])("approves at once for %o", async role => {
    m.user.mockResolvedValue({ ...user, ...role });
    const result = await submitArtistLink(artist, "u1", url);
    expect(result).toMatchObject({
      approved: true,
      message: "We updated the artist with that data",
    });
    expect(m.approve).toHaveBeenCalledWith("g1", "a1", "instagram", "p3t3rango", "tx");
    expect(m.ping).not.toHaveBeenCalled();
  });

  it("refuses a song or album and an unsupported link", async () => {
    expect(await submitArtistLink(artist, "u1", "https://music.apple.com/us/album/x/123")).toEqual({
      status: 400,
      error: "Add an artist profile link, not a song or album.",
    });
    m.extract.mockResolvedValue(null);
    expect(await submitArtistLink(artist, "u1", "https://example.com/x")).toMatchObject({
      status: 400,
    });
    expect(m.values).not.toHaveBeenCalled();
  });

  it("refuses a link the profile already has, but takes it again after it was removed", async () => {
    m.findFirst.mockResolvedValue({ id: "old" });
    expect(
      await submitArtistLink({ ...artist, instagram: "p3t3rango" } as ArtistRow, "u1", url),
    ).toEqual({ status: 409, error: "This artist data has already been added" });
    expect((await submitArtistLink(artist, "u1", url)) as object).toHaveProperty("approved");
  });

  it("files an Apple Music artist page in Lore", async () => {
    m.suggest.mockResolvedValue({ platform: "applemusic", label: "Apple Music" });
    const apple = "https://music.apple.com/us/artist/pete-rango/123";
    expect(await submitArtistLink(artist, "u1", apple)).toEqual({
      approved: false,
      siteName: "applemusic",
      platformName: "Apple Music",
      message: "Thanks for adding, the artist or an admin can review this link in Lore",
    });
    expect(m.suggest).toHaveBeenCalledWith("a1", "u1", apple);
    m.suggest.mockRejectedValue(new ArtistLinkConflictError("already"));
    expect(await submitArtistLink(artist, "u1", apple)).toEqual({ status: 409, error: "already" });
  });

  it("returns an approval conflict as a 409", async () => {
    m.user.mockResolvedValue({ ...user, isAdmin: true });
    m.approve.mockRejectedValueOnce(new ArtistLinkConflictError("taken"));
    expect(await submitArtistLink(artist, "u1", url)).toEqual({ status: 409, error: "taken" });
  });
});
