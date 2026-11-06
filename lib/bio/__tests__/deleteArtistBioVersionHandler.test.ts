import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({ validate: vi.fn(), findApprovedClaim: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/bio/deleteBioVersion", () => ({ deleteBioVersion: mock.remove }));
const { deleteArtistBioVersionHandler } = await import("@/lib/bio/deleteArtistBioVersionHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const vid = "5b7f3c1e-2d4a-4e8b-9c6f-1a2b3c4d5e6f";
const del = (versionId = vid) =>
  deleteArtistBioVersionHandler(
    new Request(`https://api.test/api/artistBio/${id}/versions/${versionId}`, { method: "DELETE" }),
    id,
    versionId,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.findApprovedClaim.mockResolvedValue(undefined);
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
  mock.remove.mockResolvedValue("deleted");
});

describe("deleteArtistBioVersionHandler", () => {
  it("deletes the version", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.remove).toHaveBeenCalledWith(vid, id, { userId: "u1", expectedClaimId: null });
  });

  it("returns 404 for a missing version and 409 for the pinned one", async () => {
    mock.remove.mockResolvedValueOnce("not_found");
    const missing = await del();
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ status: "error", error: "Bio version not found" });
    mock.remove.mockResolvedValueOnce("pinned");
    const pinned = await del();
    expect(pinned.status).toBe(409);
    expect(await pinned.json()).toEqual({
      status: "error",
      error: "Cannot delete a pinned bio version",
    });
  });

  it("refuses a bad version id and passes the auth response through", async () => {
    const bad = await del("nope");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ status: "error", error: "versionId must be a UUID" });
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValue(denied);
    expect(await del()).toBe(denied);
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("maps a claim change to 403 and a failed write to 500", async () => {
    mock.remove.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await del()).status).toBe(403);
    mock.remove.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to delete bio version" });
  });
});
