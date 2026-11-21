import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";

const m = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
const { suggestArtistDestination } =
  await import("@/lib/artistLinkSubmission/suggestArtistDestination");

const apple = "https://music.apple.com/us/artist/pete-rango/123";
beforeEach(() => vi.clearAllMocks());

describe("suggestArtistDestination", () => {
  it("files the page as a pending Lore submission attributed to the user", async () => {
    m.insert.mockResolvedValue({ id: "s1" });
    expect(await suggestArtistDestination("a1", "u1", apple)).toEqual({
      platform: "applemusic",
      label: "Apple Music",
    });
    expect(m.insert).toHaveBeenCalledWith(
      { artistId: "a1", url: apple, title: "Apple Music", type: "profile", status: "pending" },
      { userId: "u1", trigger: "link_submission" },
    );
  });

  it("refuses a page already in Lore", async () => {
    m.insert.mockResolvedValue(undefined);
    await expect(suggestArtistDestination("a1", "u1", apple)).rejects.toThrow(
      new ArtistLinkConflictError("This link has already been suggested. Review it in Lore."),
    );
  });

  it("refuses anything but an Apple Music or Beatport artist page", async () => {
    await expect(suggestArtistDestination("a1", "u1", "https://x.com/a")).rejects.toThrow(
      "Enter an Apple Music or Beatport artist page, not a song or album.",
    );
    expect(m.insert).not.toHaveBeenCalled();
  });
});
