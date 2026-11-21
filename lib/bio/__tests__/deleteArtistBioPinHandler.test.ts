import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({ validate: vi.fn(), findApprovedClaim: vi.fn(), unpin: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/bio/unpinArtistBio", () => ({ unpinArtistBio: mock.unpin }));
const { deleteArtistBioPinHandler } = await import("@/lib/bio/deleteArtistBioPinHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const del = () =>
  deleteArtistBioPinHandler(
    new Request(`https://api.test/api/artistBio/${id}/pin`, { method: "DELETE" }),
    id,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.findApprovedClaim.mockResolvedValue({ id: "c1" });
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
  mock.unpin.mockResolvedValue(undefined);
});

describe("deleteArtistBioPinHandler", () => {
  it("unpins the bio under the claim it started with", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.unpin).toHaveBeenCalledWith(id, { userId: "u1", expectedClaimId: "c1" });
  });

  it("passes the auth response through", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    mock.validate.mockResolvedValue(denied);
    expect(await del()).toBe(denied);
    expect(mock.unpin).not.toHaveBeenCalled();
  });

  it("maps a claim change to 403 and a failed write to 500", async () => {
    mock.unpin.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await del()).status).toBe(403);
    mock.unpin.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Could not unpin bio" });
  });
});
