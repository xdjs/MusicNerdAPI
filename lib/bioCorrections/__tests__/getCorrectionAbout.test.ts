import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";

const { publicAbout } = vi.hoisted(() => ({ publicAbout: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({ getPublicArtistAbout: publicAbout }));
const { getCorrectionAbout } = await import("@/lib/bioCorrections/getCorrectionAbout");

const row = {
  artist_id: "a1",
  bio: "Claimed bio.",
  claim_id: "c1",
  public_about: null,
  pinned: false,
  status: "pending",
};
const reader = (r: unknown) => ({ execute: vi.fn().mockResolvedValueOnce(r ? [r] : []) }) as never;

beforeEach(() => publicAbout.mockReset());

describe("getCorrectionAbout", () => {
  it("uses artists.bio once claimed, with a revision over every input", async () => {
    const result = await getCorrectionAbout("r1", reader(row));
    const revision = createHash("sha256")
      .update(JSON.stringify(["a1", "c1", "Claimed bio.", null, "Claimed bio."]))
      .digest("hex");
    expect(result).toEqual({ bio: "Claimed bio.", revision, artistId: "a1", claimed: true });
    expect(publicAbout).not.toHaveBeenCalled();
  });

  it("uses the published directory About before a claim", async () => {
    publicAbout.mockResolvedValueOnce({ bio: "Directory bio.", kind: "researched", sources: [] });
    const result = await getCorrectionAbout("r1", reader({ ...row, claim_id: null }));
    expect(result).toMatchObject({ bio: "Directory bio.", claimed: false });
  });

  it.each([
    ["a reviewed report", { ...row, status: "resolved" }, "already been reviewed"],
    ["a missing report", null, "already been reviewed"],
    ["a pinned About", { ...row, pinned: true }, "pinned"],
    ["no real bio", { ...row, bio: "" }, "no longer available"],
  ])("is a conflict for %s", async (_label, r, message) => {
    const p = getCorrectionAbout("r1", reader(r));
    await expect(p).rejects.toBeInstanceOf(CorrectionAboutConflict);
    await expect(getCorrectionAbout("r1", reader(r))).rejects.toThrow(message);
  });
});
