import { beforeEach, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const { findArtistByExactName } = await import("@/lib/artistLookups/findArtistByExactName");
beforeEach(() => vi.clearAllMocks());

it("does not query for a blank name", async () => {
  expect(await findArtistByExactName("   ")).toBeUndefined();
  expect(execute).not.toHaveBeenCalled();
});
it("throws on database failure rather than reporting no match", async () => {
  execute.mockRejectedValueOnce(new Error("pool"));
  await expect(findArtistByExactName("White Magic")).rejects.toThrow("pool");
});
