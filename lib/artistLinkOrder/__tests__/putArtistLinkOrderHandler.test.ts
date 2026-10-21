import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  claim: vi.fn(),
  canEdit: vi.fn(),
  links: vi.fn(),
  save: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.links }));
vi.mock("@/lib/artistLinkOrder/saveArtistLinkOrder", () => ({ saveArtistLinkOrder: m.save }));
vi.mock("@/lib/analytics/trackServerEvent", () => ({ trackServerEvent: m.track }));
const { putArtistLinkOrderHandler } =
  await import("@/lib/artistLinkOrder/putArtistLinkOrderHandler");

const artistId = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const put = (body: unknown) =>
  putArtistLinkOrderHandler(
    new Request("https://api.test/api/artist/link-order", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );
const body = { artistId, section: "links", order: ["spotify", "instagram"] };

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.claim.mockResolvedValue({ id: "c1" });
  m.canEdit.mockResolvedValue(true);
  m.links.mockResolvedValue([{ siteName: "instagram" }]);
  m.save.mockResolvedValue(true);
});

describe("putArtistLinkOrderHandler", () => {
  it("saves under the claimant's operation and counts a reorder", async () => {
    let scope: unknown;
    m.save.mockImplementation(async () => {
      scope = getArtistOperationOwnership(artistId);
      return true;
    });
    const res = await put(body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", success: true });
    expect(m.save).toHaveBeenCalledWith(artistId, "links", ["spotify", "instagram"]);
    expect(scope).toEqual({ artistId, userId: "u1", expectedClaimId: "c1" });
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.canEdit.mock.invocationCallOrder[0]);
    expect(m.track).toHaveBeenCalledWith("profile_edit", { action: "reorder", target: "links" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes a 401 through and 400s an invalid body", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await put(body)).status).toBe(401);
    const res = await put({ ...body, section: "nope" });
    expect(res.status).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
  });

  it("403s a user who may not edit the artist", async () => {
    m.canEdit.mockResolvedValue(false);
    const res = await put(body);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Not authorized for this artist" });
  });

  it("400s an unknown platform", async () => {
    const res = await put({ ...body, order: ["spotify", "myspace"] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Unknown platform" });
  });

  it("404s a missing artist and counts nothing", async () => {
    m.save.mockResolvedValue(false);
    const res = await put(body);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Artist not found" });
    expect(m.track).not.toHaveBeenCalled();
  });

  it("403s a changed claim and 500s anything else", async () => {
    m.save.mockRejectedValueOnce(new OwnershipChangedError());
    const changed = await put(body);
    expect(changed.status).toBe(403);
    expect(await changed.json()).toEqual({
      status: "error",
      error: "Artist ownership changed; this operation was cancelled.",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.save.mockRejectedValueOnce(new Error("db"));
    const failed = await put(body);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "error", error: "Could not save link order" });
    expect(failed.headers.get("Access-Control-Allow-Origin")).toBe("*");
    log.mockRestore();
  });
});
