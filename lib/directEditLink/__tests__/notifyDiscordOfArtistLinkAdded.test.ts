import { describe, it, expect, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn(async () => {}) }));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: send }));
const { notifyDiscordOfArtistLinkAdded } =
  await import("@/lib/directEditLink/notifyDiscordOfArtistLinkAdded");

describe("notifyDiscordOfArtistLinkAdded", () => {
  it("posts MusicNerdWeb's message", async () => {
    await notifyDiscordOfArtistLinkAdded({
      user: { username: "Pete" },
      artistName: "Pete Rango",
      platformName: "Instagram",
      platformId: "p3t3rango",
      submittedUrl: "https://instagram.com/p3t3rango",
      createdAt: "2026-10-21T00:00:00.000Z",
    });
    expect(send).toHaveBeenCalledWith(
      "Pete added Pete Rango's Instagram: p3t3rango (Submitted URL: https://instagram.com/p3t3rango) 2026-10-21T00:00:00.000Z",
    );
  });

  it("names an unnamed user Anonymous", async () => {
    await notifyDiscordOfArtistLinkAdded({
      user: {},
      artistName: "A",
      platformName: "P",
      platformId: "i",
      submittedUrl: "u",
      createdAt: "t",
    });
    expect(send).toHaveBeenLastCalledWith("Anonymous added A's P: i (Submitted URL: u) t");
  });
});
