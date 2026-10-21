import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  update: vi.fn(),
  findApprovedClaim: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/bio/updateArtistBio", () => ({ updateArtistBio: mock.update }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
const { putArtistBioHandler } = await import("@/lib/bio/putArtistBioHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const put = (body: unknown, artistId = id) =>
  putArtistBioHandler(
    new Request(`https://api.test/api/artistBio/${artistId}`, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    artistId,
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
  mock.update.mockResolvedValue({ status: "success", message: "Bio updated" });
});

describe("putArtistBioHandler", () => {
  it("saves a bio fenced on the claim read before authorization", async () => {
    const res = await put({ bio: "Written." });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", message: "Bio updated" });
    expect(mock.order).toEqual(["claim", "auth"]);
    expect(mock.update).toHaveBeenCalledWith(
      id,
      { bio: "Written.", regenerate: false },
      { userId: "u1", expectedClaimId: "c1" },
    );
  });

  it("returns a regenerated bio", async () => {
    mock.update.mockResolvedValue({ status: "success", message: "Bio regenerated", data: "New." });
    expect(await (await put({ regenerate: true })).json()).toEqual({
      status: "ok",
      message: "Bio regenerated",
      bio: "New.",
    });
    expect(mock.update).toHaveBeenCalledWith(id, { regenerate: true }, expect.anything());
  });

  it("maps a failed update to its status and code, 500 by default", async () => {
    mock.update.mockResolvedValue({
      status: "error",
      message: "No Lore",
      statusCode: 409,
      code: "LORE_REQUIRED",
    });
    const conflict = await put({ regenerate: true });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      status: "error",
      error: "No Lore",
      code: "LORE_REQUIRED",
    });
    mock.update.mockResolvedValue({ status: "error", message: "Unpin your bio first." });
    const failed = await put({ bio: "x" });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "error", error: "Unpin your bio first." });
  });

  it("refuses a bad id, a bad body and an unauthorized caller", async () => {
    expect((await put({ bio: "x" }, "nope")).status).toBe(400);
    expect(await (await put("not json")).json()).toEqual({
      status: "error",
      error: "Invalid bio",
    });
    mock.validate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await put({ bio: "x" })).status).toBe(401);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("an unexpected failure is a 500", async () => {
    mock.findApprovedClaim.mockRejectedValue(new Error("offline"));
    const res = await put({ bio: "x" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Error updating bio" });
  });
});
