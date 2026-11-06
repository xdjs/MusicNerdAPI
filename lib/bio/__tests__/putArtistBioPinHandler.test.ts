import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  findApprovedClaim: vi.fn(),
  pin: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/bio/pinBioVersion", () => ({ pinBioVersion: mock.pin }));
const { putArtistBioPinHandler } = await import("@/lib/bio/putArtistBioPinHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const vid = "5b7f3c1e-2d4a-4e8b-9c6f-1a2b3c4d5e6f";
const put = (body: unknown) =>
  putArtistBioPinHandler(
    new Request(`https://api.test/api/artistBio/${id}/pin`, {
      method: "PUT",
      body: JSON.stringify(body),
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
  mock.pin.mockResolvedValue({ id: vid });
});

describe("putArtistBioPinHandler", () => {
  it("pins the version fenced on the claim read before authorization", async () => {
    const res = await put({ versionId: vid });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.order).toEqual(["claim", "auth"]);
    expect(mock.pin).toHaveBeenCalledWith(vid, id, { userId: "u1", expectedClaimId: "c1" });
  });

  it("returns 404 for a version the artist doesn't have", async () => {
    mock.pin.mockResolvedValue(undefined);
    const res = await put({ versionId: vid });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Bio version not found" });
  });

  it("refuses a bad body and passes the auth response through", async () => {
    expect((await put({})).status).toBe(400);
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValue(denied);
    expect(await put({ versionId: vid })).toBe(denied);
    expect(mock.pin).not.toHaveBeenCalled();
  });

  it("maps a claim change to 403 and a failed write to 500", async () => {
    mock.pin.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await put({ versionId: vid })).status).toBe(403);
    mock.pin.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await put({ versionId: vid });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to pin bio version" });
  });
});
