import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute, clear } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: SQL) => []),
  clear: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink: clear }));
const { removeArtistData } = await import("@/lib/removeArtistData/removeArtistData");

beforeEach(() => vi.clearAllMocks());

describe("removeArtistData", () => {
  it("clears a link column", async () => {
    clear.mockResolvedValue({ oldValue: "x" });
    expect(await removeArtistData("a1", "instagram")).toEqual({
      status: "success",
      message: "Artist data removed",
    });
    expect(clear).toHaveBeenCalledWith("a1", "instagram");
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps MusicNerdWeb's wallets quirk: removes the artist id from the array", async () => {
    await removeArtistData("a1", "wallets");
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toBe("UPDATE artists SET wallets = array_remove(wallets, $1) WHERE id = $2");
    expect(params).toEqual(["a1", "a1"]);
    expect(clear).not.toHaveBeenCalled();
  });

  it("reports a non-link column and any other failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    clear.mockRejectedValueOnce(new Error("Column not in writable whitelist: bio"));
    expect(await removeArtistData("a1", "bio")).toEqual({
      status: "error",
      message: "Invalid platform column",
    });
    clear.mockRejectedValueOnce(new Error("Artist not found: a1"));
    expect(await removeArtistData("a1", "instagram")).toEqual({
      status: "error",
      message: "Error removing artist data",
    });
    log.mockRestore();
  });
});
