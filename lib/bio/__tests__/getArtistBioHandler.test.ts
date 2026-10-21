import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";

const mock = vi.hoisted(() => ({
  validate: vi.fn(),
  generate: vi.fn(),
  getArtistById: vi.fn(),
  getPublicArtistAbout: vi.fn(),
  findApprovedClaim: vi.fn(),
  order: [] as string[],
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/bio/generateArtistBio", () => ({ generateArtistBio: mock.generate }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({
  getPublicArtistAbout: mock.getPublicArtistAbout,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
const { getArtistBioHandler } = await import("@/lib/bio/getArtistBioHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const read = (query = "") =>
  getArtistBioHandler(new Request(`https://api.test/api/artistBio/${id}${query}`), id);
const about = { bio: "Directory About.", kind: "researched", sources: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mock.order.length = 0;
  mock.getArtistById.mockResolvedValue({ id, bio: "Saved About." });
  mock.findApprovedClaim.mockImplementation(async () => {
    mock.order.push("claim");
    return { id: "c1" };
  });
  mock.getPublicArtistAbout.mockResolvedValue(about);
  mock.validate.mockImplementation(async () => {
    mock.order.push("auth");
    return { artistId: id, userId: "u1" };
  });
});

describe("getArtistBioHandler", () => {
  it("a claimed artist reads its saved bio, private and uncached", async () => {
    const res = await read();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", bio: "Saved About.", publicAbout: null });
    expect(mock.getPublicArtistAbout).not.toHaveBeenCalled();
    expect(mock.validate).not.toHaveBeenCalled();
  });

  it("a claimed artist with only the claim prompt saved reads the claim prompt", async () => {
    mock.getArtistById.mockResolvedValue({ id, bio: ABOUT_EMPTY_STATE });
    expect(await (await read()).json()).toMatchObject({ bio: ABOUT_EMPTY_STATE });
  });

  it("an unclaimed artist reads the directory About, else the claim prompt", async () => {
    mock.findApprovedClaim.mockResolvedValue(undefined);
    expect(await (await read()).json()).toEqual({
      status: "ok",
      bio: "Directory About.",
      publicAbout: about,
    });
    mock.getPublicArtistAbout.mockResolvedValue(null);
    expect(await (await read()).json()).toEqual({
      status: "ok",
      bio: ABOUT_EMPTY_STATE,
      publicAbout: null,
    });
  });

  it("is a 404 for a missing artist and a 400 for a non-UUID id", async () => {
    mock.getArtistById.mockResolvedValue(undefined);
    const missing = await read();
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ status: "error", error: "Artist not found" });
    const bad = await getArtistBioHandler(new Request("https://api.test/api/artistBio/x"), "x");
    expect(bad.status).toBe(400);
  });

  it("a failed read is a 500 with CORS", async () => {
    mock.getArtistById.mockRejectedValue(new Error("offline"));
    const res = await read();
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "error",
      error: "Unable to read About. Please try again.",
    });
  });

  it("regenerate reads the claim before authorizing, then generates as the editor", async () => {
    mock.generate.mockResolvedValue({ httpStatus: 200, bio: "Fresh." });
    const res = await read("?regenerate=true");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", bio: "Fresh." });
    expect(mock.order).toEqual(["claim", "auth"]);
    expect(mock.generate).toHaveBeenCalledWith(id, { userId: "u1", expectedClaimId: "c1" });
  });

  it("regenerate passes on the auth failure and the generation error", async () => {
    mock.validate.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not your artist" }, { status: 403 }),
    );
    expect((await read("?regenerate=true")).status).toBe(403);
    expect(mock.generate).not.toHaveBeenCalled();
    mock.generate.mockResolvedValue({ httpStatus: 409, code: "LORE_REQUIRED", error: "No Lore" });
    const res = await read("?regenerate=true");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "error", code: "LORE_REQUIRED", error: "No Lore" });
  });
});
