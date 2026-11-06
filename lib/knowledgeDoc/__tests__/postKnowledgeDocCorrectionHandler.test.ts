import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  findApprovedClaim: vi.fn(),
  upsert: vi.fn(),
  refresh: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/knowledgeDoc/upsertDocCorrection", () => ({ upsertDocCorrection: mock.upsert }));
vi.mock("@/lib/knowledgeDoc/refreshLoreAfterCorrection", () => ({
  refreshLoreAfterCorrection: mock.refresh,
}));
const { postKnowledgeDocCorrectionHandler } =
  await import("@/lib/knowledgeDoc/postKnowledgeDocCorrectionHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const post = (body: unknown) =>
  postKnowledgeDocCorrectionHandler(
    new Request(`https://api.test/api/artist/${id}/knowledge-doc/corrections`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    id,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.order.length = 0;
  mock.findApprovedClaim.mockImplementation(async () => {
    mock.order.push("claim");
    return { id: "c1" };
  });
  mock.validate.mockImplementation(async () => {
    mock.order.push("auth");
    return { artistId: id, userId: "u1" };
  });
  mock.upsert.mockResolvedValue(undefined);
  mock.refresh.mockResolvedValue(undefined);
});

describe("postKnowledgeDocCorrectionHandler", () => {
  it("saves the correction fenced on the claim read before auth, then queues a rebuild", async () => {
    const res = await post({ claim: " A. ", kind: "fix", correction: " B. " });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.order).toEqual(["claim", "auth"]);
    expect(mock.upsert).toHaveBeenCalledWith(id, "A.", "fix", "B.", {
      userId: "u1",
      expectedClaimId: "c1",
    });
    expect(mock.refresh).toHaveBeenCalledWith(id, "c1", "u1");
  });

  it("refuses a bad body before writing", async () => {
    const res = await post({ claim: "A.", kind: "fix" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Write your correction first" });
    expect(mock.upsert).not.toHaveBeenCalled();
    expect((await post("not json")).status).toBe(400);
  });

  it("returns the auth response unchanged", async () => {
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValue(denied);
    expect(await post({ claim: "A.", kind: "wrong" })).toBe(denied);
    expect(mock.upsert).not.toHaveBeenCalled();
  });

  it("returns 403 when the claim changed during the write", async () => {
    mock.upsert.mockRejectedValue(new OwnershipChangedError());
    const res = await post({ claim: "A.", kind: "wrong" });
    expect(res.status).toBe(403);
    expect(mock.refresh).not.toHaveBeenCalled();
  });

  it("returns 500 when the write fails", async () => {
    mock.upsert.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ claim: "A.", kind: "wrong" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to save your correction" });
  });
});
