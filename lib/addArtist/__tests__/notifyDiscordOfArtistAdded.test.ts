import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), send: vi.fn(async () => {}) }));
vi.mock("@/lib/users/getUserById", () => ({ getUserById: m.user }));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: m.send }));
const { notifyDiscordOfArtistAdded } = await import("@/lib/addArtist/notifyDiscordOfArtistAdded");

beforeEach(() => vi.clearAllMocks());

describe("notifyDiscordOfArtistAdded", () => {
  it("posts MusicNerdWeb's wording", async () => {
    m.user.mockResolvedValue({ username: "pete", wallet: null });
    await notifyDiscordOfArtistAdded({
      userId: "u1",
      artistName: "Radiohead",
      platform: "spotify",
      platformId: "s1",
      createdAt: "2026-10-28",
    });
    expect(m.send).toHaveBeenCalledWith(
      "pete added new artist named: Radiohead (Submitted spotifyId: s1) 2026-10-28",
    );
  });

  it("stays quiet for an unknown user and never throws", async () => {
    m.user.mockResolvedValueOnce(undefined);
    await notifyDiscordOfArtistAdded({
      userId: "u1",
      artistName: "R",
      platform: "deezer",
      platformId: "1",
      createdAt: null,
    });
    expect(m.send).not.toHaveBeenCalled();
    m.user.mockRejectedValueOnce(new Error("db"));
    await expect(
      notifyDiscordOfArtistAdded({
        userId: "u1",
        artistName: "R",
        platform: "deezer",
        platformId: "1",
        createdAt: null,
      }),
    ).resolves.toBeUndefined();
  });
});
