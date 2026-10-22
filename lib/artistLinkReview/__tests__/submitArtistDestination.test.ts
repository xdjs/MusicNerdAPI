import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

const m = vi.hoisted(() => ({
  execute: vi.fn(async (_q: SQL): Promise<unknown[]> => []),
  insert: vi.fn(),
  review: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insert }));
vi.mock("@/lib/artistLinkReview/reviewArtistLinkSuggestion", () => ({
  reviewArtistLinkSuggestion: m.review,
}));
const { submitArtistDestination } = await import("@/lib/artistLinkReview/submitArtistDestination");

const apple = "https://music.apple.com/us/artist/pete-rango/123#bio";
beforeEach(() => vi.clearAllMocks());

describe("submitArtistDestination", () => {
  it("files the page as a pending submission under the user's operation, then approves it", async () => {
    let scope: unknown;
    m.insert.mockImplementation(async () => {
      scope = getArtistOperationOwnership("a1");
      return { id: "s1" };
    });
    expect(await submitArtistDestination("a1", "u1", apple, "c1", true)).toEqual({
      id: "s1",
      platform: "applemusic",
      label: "Apple Music",
    });
    expect(m.insert).toHaveBeenCalledWith({
      artistId: "a1",
      url: apple,
      title: "Apple Music",
      type: "profile",
      status: "pending",
    });
    expect(scope).toEqual({
      artistId: "a1",
      userId: "u1",
      expectedClaimId: "c1",
      trigger: "link_submission",
      sourceOrigin: "submission",
    });
    expect(m.review).toHaveBeenCalledWith("a1", "u1", {
      kind: "source",
      id: "s1",
      decision: "approve",
    });
  });

  it("leaves it pending without approve, and keeps Beatport's platform name", async () => {
    m.insert.mockResolvedValue({ id: "s2" });
    expect(
      await submitArtistDestination("a1", "u1", "https://www.beatport.com/artist/pete/42", null),
    ).toEqual({ id: "s2", platform: "beatport", label: "Beatport" });
    expect(m.review).not.toHaveBeenCalled();
  });

  it("approves or shows again a page already in Lore, looked up by its canonical URL", async () => {
    m.insert.mockResolvedValue(undefined);
    m.execute.mockResolvedValueOnce([{ id: "s3", status: "pending" }]);
    expect(await submitArtistDestination("a1", "u1", apple, "c1", true)).toMatchObject({
      id: "s3",
    });
    const { text, params } = renderSql(m.execute.mock.calls[0][0]);
    expect(text).toBe(
      "select id,status from artist_vault_sources where artist_id=$1::uuid and url=$2",
    );
    expect(params).toEqual(["a1", "https://music.apple.com/us/artist/pete-rango/123"]);
    expect(m.review).toHaveBeenLastCalledWith("a1", "u1", {
      kind: "source",
      id: "s3",
      decision: "approve",
    });
    m.execute.mockResolvedValueOnce([{ id: "s3", status: "approved" }]);
    await submitArtistDestination("a1", "u1", apple, "c1", true);
    expect(m.review).toHaveBeenLastCalledWith("a1", "u1", {
      kind: "source",
      id: "s3",
      decision: "restore",
    });
  });

  it("409s a page already suggested that it can't approve", async () => {
    m.insert.mockResolvedValue(undefined);
    const conflict = new ArtistLinkConflictError(
      "This link has already been suggested. Review it in Lore.",
    );
    await expect(submitArtistDestination("a1", "u1", apple, "c1")).rejects.toEqual(conflict);
    m.execute.mockResolvedValueOnce([{ id: "s3", status: "rejected" }]);
    await expect(submitArtistDestination("a1", "u1", apple, "c1", true)).rejects.toEqual(conflict);
    expect(m.review).not.toHaveBeenCalled();
  });

  it("refuses anything but an Apple Music or Beatport artist page", async () => {
    await expect(
      submitArtistDestination("a1", "u1", "https://music.apple.com/us/album/x/1", "c1"),
    ).rejects.toThrow("Enter an Apple Music or Beatport artist page, not a song or album.");
    await expect(
      submitArtistDestination(
        "a1",
        "u1",
        "https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF",
        "c1",
      ),
    ).rejects.toThrow("Enter an Apple Music or Beatport artist page");
    expect(m.insert).not.toHaveBeenCalled();
  });
});
