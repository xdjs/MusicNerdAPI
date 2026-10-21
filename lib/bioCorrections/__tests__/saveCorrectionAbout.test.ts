import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { CorrectionAboutConflict } from "@/lib/bioCorrections/CorrectionAboutConflict";
import { saveCorrectionAbout } from "@/lib/bioCorrections/saveCorrectionAbout";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  execute: vi.fn(),
  current: vi.fn(),
  versions: vi.fn(),
  activity: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mock.transaction } }));
vi.mock("@/lib/bioCorrections/getCorrectionAbout", () => ({ getCorrectionAbout: mock.current }));
vi.mock("@/lib/bio/saveBioVersions", () => ({ saveBioVersions: mock.versions }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: mock.activity }));

const tx = { execute: mock.execute };
const sqlOf = (call: number) => renderSql(mock.execute.mock.calls[call][0] as SQL);
const current = { bio: "Old bio", revision: "rev", artistId: "a1", claimed: true };

beforeEach(() => {
  vi.clearAllMocks();
  mock.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
  mock.execute.mockResolvedValue([]);
  mock.execute
    .mockResolvedValueOnce([{ id: "admin" }]) // admin re-check
    .mockResolvedValueOnce([{ id: "a1" }]); // artist lock
  mock.current.mockResolvedValue(current);
  mock.activity.mockResolvedValue("event");
});

describe("saveCorrectionAbout", () => {
  it("re-checks the admin, locks artist then report then preparation, and writes a claimed artist's bio", async () => {
    await saveCorrectionAbout("r1", "admin", "New bio", "rev");
    expect(sqlOf(0).text).toBe("select id from users where id=$1::uuid and is_admin=true");
    expect(sqlOf(0).params).toEqual(["admin"]);
    expect(sqlOf(1).text).toMatch(/for update of a$/);
    expect(sqlOf(2).text).toBe(
      "select id from artist_bio_corrections where id=$1::uuid for update",
    );
    expect(sqlOf(3).text).toBe(
      "select artist_id from artist_directory_preparations where artist_id=$1::uuid for update",
    );
    expect(mock.current).toHaveBeenCalledWith("r1", tx);
    expect(mock.versions).toHaveBeenCalledWith(tx, "a1", ["Old bio", "New bio"]);
    expect(sqlOf(4).text).toBe("update artists set bio=$1 where id=$2::uuid");
    expect(sqlOf(4).params).toEqual(["New bio", "a1"]);
    expect(mock.activity).toHaveBeenCalledWith(
      "a1",
      "about_edited",
      { userId: "admin", trigger: "about_correction" },
      tx,
    );
    expect(sqlOf(5).text).toBe(
      "update artist_bio_corrections set status='resolved',reviewed_at=now(),reviewed_by=$1::uuid where id=$2::uuid",
    );
    expect(sqlOf(5).params).toEqual(["admin", "r1"]);
  });

  it("writes an unclaimed artist's public About in place, marked as admin-edited", async () => {
    mock.current.mockResolvedValueOnce({ ...current, claimed: false });
    await saveCorrectionAbout("r1", "admin", "New bio", "rev");
    expect(sqlOf(4).text).toContain("update artist_directory_preparations");
    expect(sqlOf(4).text).toContain("'editedByAdmin',true");
    expect(sqlOf(4).params).toEqual(["New bio", "a1"]);
    expect(mock.execute.mock.calls.map(c => renderSql(c[0] as SQL).text)).not.toContainEqual(
      expect.stringContaining("update artists set bio"),
    );
  });

  it("refuses a stale revision before writing anything", async () => {
    await expect(saveCorrectionAbout("r1", "admin", "New bio", "other")).rejects.toThrow(
      "The About or artist ownership changed. Your draft is kept; cancel and reopen the editor to review the latest version.",
    );
    expect(mock.versions).not.toHaveBeenCalled();
    expect(mock.activity).not.toHaveBeenCalled();
    expect(mock.execute).toHaveBeenCalledTimes(4);
  });

  it("refuses a non-admin inside the transaction", async () => {
    mock.execute.mockReset().mockResolvedValueOnce([]);
    await expect(saveCorrectionAbout("r1", "someone", "New bio", "rev")).rejects.toThrow(
      "Administrator access is required.",
    );
    expect(mock.current).not.toHaveBeenCalled();
  });

  it("refuses when the report no longer exists", async () => {
    mock.execute
      .mockReset()
      .mockResolvedValueOnce([{ id: "admin" }])
      .mockResolvedValueOnce([]);
    await expect(saveCorrectionAbout("r1", "admin", "New bio", "rev")).rejects.toThrow(
      "This report no longer exists.",
    );
  });

  it("refuses the claim nudge or an over-long About before opening a transaction", async () => {
    await expect(saveCorrectionAbout("r1", "admin", ABOUT_EMPTY_STATE, "rev")).rejects.toThrow(
      CorrectionAboutConflict,
    );
    await expect(saveCorrectionAbout("r1", "admin", "x".repeat(10_001), "rev")).rejects.toThrow(
      "Enter an About of up to 10,000 characters.",
    );
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("lets a conflict from the read propagate", async () => {
    mock.current.mockRejectedValueOnce(new CorrectionAboutConflict("This About is pinned."));
    await expect(saveCorrectionAbout("r1", "admin", "New bio", "rev")).rejects.toThrow(
      "This About is pinned.",
    );
  });
});
