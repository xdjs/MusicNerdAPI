import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artistVaultSources: { findFirst } } } }));
const { getVaultUploadByPath } = await import("@/lib/vault/getVaultUploadByPath");

beforeEach(() => findFirst.mockReset());

describe("getVaultUploadByPath", () => {
  it("finds the artist's source stored at that key", async () => {
    findFirst.mockResolvedValue({ id: "s1" });
    expect(await getVaultUploadByPath("a1", "a1/x.pdf")).toEqual({ id: "s1" });
    const { text, params } = renderSql(findFirst.mock.calls[0][0].where);
    expect(text).toContain('"artist_id" = $1');
    expect(text).toContain('"file_path" = $2');
    expect(params).toEqual(["a1", "a1/x.pdf"]);
  });

  it("is undefined for a missing row, and throws rather than hiding a failed read", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getVaultUploadByPath("a1", "a1/x.pdf")).toBeUndefined();
    findFirst.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(getVaultUploadByPath("a1", "a1/x.pdf")).rejects.toThrow("database unavailable");
  });
});
