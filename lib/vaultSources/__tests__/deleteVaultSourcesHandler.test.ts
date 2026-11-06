import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({ edit: vi.fn(), claim: vi.fn(), del: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: mock.edit }));
vi.mock("@/lib/ownership/getLoreClaimGeneration", () => ({ getLoreClaimGeneration: mock.claim }));
vi.mock("@/lib/vault/deleteVaultSources", () => ({ deleteVaultSources: mock.del }));
vi.mock("@/lib/vaultSources/queueSourceChangeRefresh", () => ({
  queueSourceChangeRefresh: mock.refresh,
}));
const { deleteVaultSourcesHandler } = await import("@/lib/vaultSources/deleteVaultSourcesHandler");

const ids = ["2c6f1c6e-4f0a-4b9b-8a6a-3b1f0b2d9e71", "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"];
const call = (body: unknown) =>
  deleteVaultSourcesHandler(
    new Request("https://api.test/x", { method: "DELETE", body: JSON.stringify(body) }),
    "a1",
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.edit.mockResolvedValue({ artistId: "a1", userId: "u1" });
  mock.claim.mockResolvedValue("c1");
  mock.del.mockResolvedValue([{ id: ids[0] }, { id: ids[1] }]);
});

describe("deleteVaultSourcesHandler", () => {
  it("deletes the sources, counts them and refreshes Lore once", async () => {
    const res = await call({ sourceIds: ids });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", count: 2 });
    expect(mock.del).toHaveBeenCalledWith("a1", ids);
    expect(mock.refresh).toHaveBeenCalledTimes(1);
    expect(mock.refresh).toHaveBeenCalledWith("a1", "c1", "u1");
  });

  it("is a 404 when any id isn't the artist's", async () => {
    mock.del.mockResolvedValueOnce(undefined);
    const res = await call({ sourceIds: ids });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "One or more sources not found" });
    expect(mock.refresh).not.toHaveBeenCalled();
  });

  it("is a 400 for a bad body, and passes on the artist check's response", async () => {
    expect((await call({ sourceIds: [] })).status).toBe(400);
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    mock.edit.mockResolvedValueOnce(denied);
    expect(await call({ sourceIds: ids })).toBe(denied);
  });

  it("is a 500 when the delete fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.del.mockRejectedValueOnce(new Error("pool"));
    expect((await call({ sourceIds: ids })).status).toBe(500);
    error.mockRestore();
  });
});
