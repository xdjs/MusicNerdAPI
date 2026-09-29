import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_q: SQL): Promise<unknown> => []) }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { nameIsAmbiguousInDirectory } = await import("@/lib/identity/nameIsAmbiguousInDirectory");

beforeEach(() => execute.mockReset().mockResolvedValue([]));

describe("nameIsAmbiguousInDirectory", () => {
  it("is true when another artist's folded name starts with this one", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    expect(await nameIsAmbiguousInDirectory("a1", "Black Dave")).toBe(true);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("regexp_replace(lower(name), '[^a-z0-9]', '', 'g') like $1");
    expect(params[0]).toBe("blackdave%");
  });

  it("is false for a unique name", async () => {
    expect(await nameIsAmbiguousInDirectory("a1", "Black Dave MK2")).toBe(false);
  });

  it("treats a name under four characters as ambiguous without querying", async () => {
    expect(await nameIsAmbiguousInDirectory("a1", "D.J")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed on a database error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await nameIsAmbiguousInDirectory("a1", "Pete Rango")).toBe(true);
    err.mockRestore();
  });
});
