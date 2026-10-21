import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { SQL } from "drizzle-orm";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { getCorrectionAbout } from "@/lib/bioCorrections/getCorrectionAbout";

const mock = vi.hoisted(() => ({ execute: vi.fn(), publicAbout: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));
vi.mock("@/lib/bioCorrections/getPublicArtistAbout", () => ({
  getPublicArtistAbout: mock.publicAbout,
}));

const row = {
  artist_id: "a1",
  bio: "Stored bio",
  claim_id: "c1",
  public_about: null,
  pinned: false,
  status: "pending",
};
const revisionOf = (parts: unknown[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

beforeEach(() => vi.clearAllMocks());

describe("getCorrectionAbout", () => {
  it("uses artists.bio for a claimed artist, with a revision over the row", async () => {
    mock.execute.mockResolvedValueOnce([row]);
    expect(await getCorrectionAbout("r1")).toEqual({
      bio: "Stored bio",
      revision: revisionOf(["a1", "c1", "Stored bio", null, "Stored bio"]),
      artistId: "a1",
      claimed: true,
    });
    expect(mock.publicAbout).not.toHaveBeenCalled();
    const { text, params } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(params).toEqual(["r1"]);
    expect(text).toContain("from artist_bio_corrections r join artists a on a.id=r.artist_id");
  });

  it("uses the public directory About for an unclaimed artist", async () => {
    const publicAbout = { version: 1, bio: "Public bio" };
    mock.execute.mockResolvedValueOnce([
      { ...row, claim_id: null, bio: "Private draft", public_about: publicAbout },
    ]);
    mock.publicAbout.mockResolvedValueOnce({ bio: "Public bio", kind: "researched", sources: [] });
    expect(await getCorrectionAbout("r1")).toEqual({
      bio: "Public bio",
      revision: revisionOf(["a1", null, "Private draft", publicAbout, "Public bio"]),
      artistId: "a1",
      claimed: false,
    });
    expect(mock.publicAbout).toHaveBeenCalledWith("a1", expect.anything());
  });

  it.each([
    ["a missing report", [], "This report has already been reviewed or no longer exists."],
    [
      "a reviewed report",
      [{ ...row, status: "resolved" }],
      "This report has already been reviewed or no longer exists.",
    ],
    [
      "a pinned About",
      [{ ...row, pinned: true }],
      "This About is pinned. Unpin it on the artist profile before editing.",
    ],
    [
      "a claimed artist with the claim nudge as bio",
      [{ ...row, bio: ABOUT_EMPTY_STATE }],
      "The published About is no longer available. Review the artist profile before resolving this report.",
    ],
  ])("throws a conflict for %s", async (_, rows, message) => {
    mock.execute.mockResolvedValueOnce(rows);
    await expect(getCorrectionAbout("r1")).rejects.toThrow(CorrectionAboutConflict);
    mock.execute.mockResolvedValueOnce(rows);
    await expect(getCorrectionAbout("r1")).rejects.toThrow(message);
  });

  it("throws a conflict for an unclaimed artist with no publishable About", async () => {
    mock.execute.mockResolvedValueOnce([{ ...row, claim_id: null }]);
    mock.publicAbout.mockResolvedValueOnce(null);
    await expect(getCorrectionAbout("r1")).rejects.toThrow(
      "The published About is no longer available. Review the artist profile before resolving this report.",
    );
  });

  it("reads with the caller's transaction when given one", async () => {
    const execute = vi.fn().mockResolvedValueOnce([row]);
    await getCorrectionAbout("r1", { execute } as never);
    expect(execute).toHaveBeenCalled();
    expect(mock.execute).not.toHaveBeenCalled();
  });
});
