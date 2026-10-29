import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  findApprovedClaim: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/knowledgeDoc/deleteDocCorrection", () => ({ deleteDocCorrection: mock.remove }));
vi.mock("@/lib/knowledgeDoc/refreshLoreAfterCorrection", () => ({
  refreshLoreAfterCorrection: mock.refresh,
}));
const { deleteKnowledgeDocCorrectionHandler } =
  await import("@/lib/knowledgeDoc/deleteKnowledgeDocCorrectionHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const correctionId = "8e1d2c3b-4a5f-4e6d-8c7b-9a0f1e2d3c4b";
const del = (cid = correctionId) =>
  deleteKnowledgeDocCorrectionHandler(
    new Request(`https://api.test/api/artist/${id}/knowledge-doc/corrections/${cid}`, {
      method: "DELETE",
    }),
    id,
    cid,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.findApprovedClaim.mockResolvedValue(null);
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
  mock.remove.mockResolvedValue(undefined);
});

describe("deleteKnowledgeDocCorrectionHandler", () => {
  it("removes the correction and queues a rebuild", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.remove).toHaveBeenCalledWith(id, correctionId, {
      userId: "u1",
      expectedClaimId: null,
    });
    expect(mock.refresh).toHaveBeenCalledWith(id, null, "u1");
  });

  it("refuses a correction id that isn't a UUID", async () => {
    const res = await del("nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "correctionId must be a UUID" });
    expect(mock.remove).not.toHaveBeenCalled();
  });

  it("returns the auth response unchanged", async () => {
    const denied = NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
    mock.validate.mockResolvedValue(denied);
    expect(await del()).toBe(denied);
  });

  it("maps a claim change to 403 and a failed write to 500", async () => {
    mock.remove.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await del()).status).toBe(403);
    mock.remove.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await del();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to undo" });
  });
});
