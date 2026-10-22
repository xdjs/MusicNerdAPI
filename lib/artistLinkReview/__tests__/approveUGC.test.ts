import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { fakeTransaction } from "./fakeTransaction";

const { setLink } = vi.hoisted(() => ({ setLink: vi.fn() }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: setLink }));
const { approveUGC } = await import("@/lib/artistLinkReview/approveUGC");

beforeEach(() => vi.clearAllMocks());
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("approveUGC", () => {
  it("writes the value in the review's transaction and marks the row accepted", async () => {
    const tx = fakeTransaction();
    await approveUGC("g1", "a1", "instagram", "p3t3rango", tx as never);
    expect(setLink).toHaveBeenCalledWith("a1", "instagram", "p3t3rango", undefined, tx);
    expect(tx.set).toHaveBeenCalledWith({ accepted: true, dateProcessed: expect.any(String) });
    const where = new PgDialect().sqlToQuery(tx.where.mock.calls[0][0] as never);
    expect(where.sql).toBe('"ugcresearch"."id" = $1');
    expect(where.params).toEqual(["g1"]);
  });

  it.each([
    ["youtubechannel", "https://www.youtube.com/channel/UC123/videos", "UC123"],
    ["youtubechannel", "youtube.com/channel/UC9", "UC9"],
    ["youtubechannel", "UCraw", "UCraw"],
    ["youtube", "https://youtube.com/@pete", "pete"],
    ["youtube", "@pete", "pete"],
    ["youtube", "pete", "pete"],
  ])("normalizes %s %s to %s", async (site, value, stored) => {
    await approveUGC("g1", "a1", site, value, fakeTransaction() as never);
    expect(setLink.mock.calls[0][2]).toBe(stored);
  });

  it("appends a wallet to the array once instead of setting a column", async () => {
    const tx = fakeTransaction();
    await approveUGC("g1", "a1", "wallets", "0xabc", tx as never);
    const [{ text, params }] = tx.statements();
    expect(text).toBe(
      "UPDATE artists SET wallets = array_append(wallets, $1) WHERE id = $2 AND NOT wallets @> ARRAY[$3]",
    );
    expect(params).toEqual(["0xabc", "a1", "0xabc"]);
    expect(setLink).not.toHaveBeenCalled();
  });

  it("rethrows a conflict and wraps anything else", async () => {
    const log = quiet();
    const conflict = new ArtistLinkConflictError("taken");
    setLink.mockRejectedValueOnce(conflict);
    await expect(approveUGC("g1", "a1", "spotify", "S", fakeTransaction() as never)).rejects.toBe(
      conflict,
    );
    setLink.mockRejectedValueOnce(new Error("Column not in writable whitelist: bio"));
    await expect(approveUGC("g1", "a1", "bio", "x", fakeTransaction() as never)).rejects.toThrow(
      "Error approving UGC: Column not in writable whitelist: bio",
    );
    log.mockRestore();
  });
});
