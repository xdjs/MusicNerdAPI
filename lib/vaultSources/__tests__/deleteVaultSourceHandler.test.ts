import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({ validate: vi.fn(), del: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/vaultSources/validateSourceEditRequest", () => ({
  validateSourceEditRequest: mock.validate,
}));
vi.mock("@/lib/vault/deleteVaultSources", () => ({ deleteVaultSources: mock.del }));
vi.mock("@/lib/vaultSources/queueSourceChangeRefresh", () => ({
  queueSourceChangeRefresh: mock.refresh,
}));
const { deleteVaultSourceHandler } = await import("@/lib/vaultSources/deleteVaultSourceHandler");

const call = () =>
  deleteVaultSourceHandler(new Request("https://api.test/x", { method: "DELETE" }), "a1", "s1");

beforeEach(() => {
  vi.clearAllMocks();
  mock.validate.mockResolvedValue({ artistId: "a1", userId: "u1", sourceId: "s1", claimId: "c1" });
  mock.del.mockResolvedValue([{ id: "s1" }]);
});

describe("deleteVaultSourceHandler", () => {
  it("deletes the artist's source and refreshes Lore", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.del).toHaveBeenCalledWith("a1", ["s1"]);
    expect(mock.refresh).toHaveBeenCalledWith("a1", "c1", "u1");
  });

  it("is a 404 when the source went away meanwhile", async () => {
    mock.del.mockResolvedValueOnce(undefined);
    expect((await call()).status).toBe(404);
    expect(mock.refresh).not.toHaveBeenCalled();
  });

  it("passes on the request check's response, and is a 500 on a failed delete", async () => {
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValueOnce(denied);
    expect(await call()).toBe(denied);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.del.mockRejectedValueOnce(new Error("pool"));
    expect((await call()).status).toBe(500);
    error.mockRestore();
  });
});
