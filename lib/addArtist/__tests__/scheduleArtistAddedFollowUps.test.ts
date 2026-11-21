import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ after: vi.fn(), wake: vi.fn(), notify: vi.fn() }));
vi.mock("next/server", async importOriginal => ({
  ...(await importOriginal<object>()),
  after: m.after,
}));
vi.mock("@/lib/addArtist/wakeDirectoryDiscovery", () => ({ wakeDirectoryDiscovery: m.wake }));
vi.mock("@/lib/addArtist/notifyDiscordOfArtistAdded", () => ({
  notifyDiscordOfArtistAdded: m.notify,
}));
const { scheduleArtistAddedFollowUps } =
  await import("@/lib/addArtist/scheduleArtistAddedFollowUps");

const input = {
  origin: "https://api.test",
  userId: "u1",
  artistId: "a1",
  artistName: "Radiohead",
  platform: "spotify" as const,
  platformId: "s1",
  createdAt: "t",
};
beforeEach(() => vi.clearAllMocks());

describe("scheduleArtistAddedFollowUps", () => {
  it("wakes directory research and tells Discord after the response", async () => {
    m.wake.mockResolvedValue(true);
    scheduleArtistAddedFollowUps(input);
    expect(m.after).toHaveBeenCalledTimes(2);
    for (const [task] of m.after.mock.calls) await task();
    expect(m.wake).toHaveBeenCalledWith("https://api.test", "a1");
    expect(m.notify).toHaveBeenCalledWith({
      userId: "u1",
      artistName: "Radiohead",
      platform: "spotify",
      platformId: "s1",
      createdAt: "t",
    });
  });

  it("never throws when scheduling fails", () => {
    m.after.mockImplementation(() => {
      throw new Error("outside a request");
    });
    expect(() => scheduleArtistAddedFollowUps(input)).not.toThrow();
  });
});
