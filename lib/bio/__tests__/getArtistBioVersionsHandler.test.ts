import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ validate: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/bio/getBioVersionsByArtistId", () => ({ getBioVersionsByArtistId: mock.list }));
const { getArtistBioVersionsHandler } = await import("@/lib/bio/getArtistBioVersionsHandler");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const get = () =>
  getArtistBioVersionsHandler(new Request(`https://api.test/api/artistBio/${id}/versions`), id);

beforeEach(() => {
  vi.clearAllMocks();
  mock.validate.mockResolvedValue({ artistId: id, userId: "u1" });
});

describe("getArtistBioVersionsHandler", () => {
  it("lists the versions for the claimant or an admin", async () => {
    const versions = [{ id: "v1", artistId: id, bioText: "B", isPinned: true, createdAt: "t" }];
    mock.list.mockResolvedValue(versions);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ status: "ok", versions });
    expect(mock.list).toHaveBeenCalledWith(id);
  });

  it("returns the auth response unchanged", async () => {
    const denied = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    mock.validate.mockResolvedValue(denied);
    expect(await get()).toBe(denied);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("returns 500 when the read fails", async () => {
    mock.list.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to load bio versions" });
  });
});
