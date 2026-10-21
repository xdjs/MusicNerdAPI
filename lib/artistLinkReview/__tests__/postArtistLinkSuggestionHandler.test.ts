import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const m = vi.hoisted(() => ({ auth: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/artistLinkReview/reviewArtistLinkSuggestion", () => ({
  reviewArtistLinkSuggestion: m.review,
}));
const { postArtistLinkSuggestionHandler } =
  await import("@/lib/artistLinkReview/postArtistLinkSuggestionHandler");

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const input = { id: "0f3a7c62-1d7e-4b1e-9a7a-5b1f0c0e2a11", kind: "ugc", decision: "approve" };
const post = (body: unknown = input) =>
  postArtistLinkSuggestionHandler(
    new Request(`https://api.test/api/artist/${id}/link-suggestions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    id,
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("postArtistLinkSuggestionHandler", () => {
  it("applies the decision as the signed-in user", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(m.review).toHaveBeenCalledWith(id, "u1", input);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes 401 through and 400s a bad body", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await post()).status).toBe(401);
    const res = await post({ ...input, decision: "nope" });
    expect(res.status).toBe(400);
    expect(m.review).not.toHaveBeenCalled();
  });

  it("maps a non-owner to 403, a conflict to 409 with its message, anything else to 500", async () => {
    m.review.mockRejectedValueOnce(new OwnershipChangedError());
    expect(await (await post()).json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    m.review.mockRejectedValueOnce(
      new ArtistLinkConflictError(
        "This suggestion has already been reviewed. Refresh the profile.",
      ),
    );
    const conflict = await post();
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      status: "error",
      error: "This suggestion has already been reviewed. Refresh the profile.",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.review.mockRejectedValueOnce(new Error("db"));
    const failed = await post();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "error", error: "Could not review this link" });
    log.mockRestore();
  });
  it("answers a JSON 500 with CORS when signing in throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.auth.mockRejectedValueOnce(new Error("db down"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Could not review this link" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    log.mockRestore();
  });
});
