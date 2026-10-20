import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";

const { execute, current, versions, activity } = vi.hoisted(() => ({
  execute: vi.fn(),
  current: vi.fn(),
  versions: vi.fn(),
  activity: vi.fn(),
}));
const tx = { execute };
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (t: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/bioCorrections/getCorrectionAbout", () => ({ getCorrectionAbout: current }));
vi.mock("@/lib/bio/saveBioVersions", () => ({ saveBioVersions: versions }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: activity }));
const { saveCorrectionAbout } = await import("@/lib/bioCorrections/saveCorrectionAbout");

const dialect = new PgDialect();
const statements = () => execute.mock.calls.map(([q]) => dialect.sqlToQuery(q as SQL).sql);

beforeEach(() => {
  execute
    .mockReset()
    .mockResolvedValueOnce([{ id: "admin" }])
    .mockResolvedValueOnce([{ id: "a1" }])
    .mockResolvedValue([]);
  current.mockReset().mockResolvedValue({ bio: "Old.", revision: "rev", claimed: true });
  versions.mockReset();
  activity.mockReset();
});

describe("saveCorrectionAbout", () => {
  it("locks artist first, keeps history, writes the claimed bio and resolves", async () => {
    await saveCorrectionAbout("r1", "admin", "New.", "rev");
    const s = statements();
    expect(s[1]).toContain("for update of a");
    expect(s[2]).toContain("from artist_bio_corrections");
    expect(s[3]).toContain("from artist_directory_preparations");
    expect(current).toHaveBeenCalledWith("r1", tx);
    expect(versions).toHaveBeenCalledWith(tx, "a1", ["Old.", "New."]);
    expect(s[4]).toContain("update artists set bio=");
    expect(activity).toHaveBeenCalledWith(
      "a1",
      "about_edited",
      { userId: "admin", trigger: "about_correction" },
      tx,
    );
    expect(s[5]).toContain("set status='resolved'");
  });

  it("edits only the public About before a claim", async () => {
    current.mockResolvedValueOnce({ bio: "Old.", revision: "rev", claimed: false });
    await saveCorrectionAbout("r1", "admin", "New.", "rev");
    expect(statements()[4]).toContain("'editedByAdmin',true");
  });

  it.each([
    ["an invalid bio", "", "rev", "up to 10,000"],
    ["a stale revision", "New.", "other", "changed"],
  ])("is a conflict for %s", async (_label, bio, revision, message) => {
    const p = saveCorrectionAbout("r1", "admin", bio, revision);
    await expect(p).rejects.toBeInstanceOf(CorrectionAboutConflict);
    await expect(p).rejects.toThrow(message);
  });

  it("is a conflict for a non-admin", async () => {
    execute.mockReset().mockResolvedValueOnce([]);
    await expect(saveCorrectionAbout("r1", "u", "New.", "rev")).rejects.toThrow(
      "Administrator access is required.",
    );
  });
});
