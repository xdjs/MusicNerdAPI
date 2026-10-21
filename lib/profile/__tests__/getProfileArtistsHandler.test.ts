import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, contributed } = vi.hoisted(() => ({ auth: vi.fn(), contributed: vi.fn() }));
vi.mock("@/lib/profile/authenticateProfileRequest", () => ({ authenticateProfileRequest: auth }));
vi.mock("@/lib/profile/getContributedArtists", () => ({ getContributedArtists: contributed }));
const { getProfileArtistsHandler } = await import("@/lib/profile/getProfileArtistsHandler");

const request = (query = "") => new Request(`https://x/api/profile/artists${query}`);

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  contributed.mockReset().mockResolvedValue({
    artists: [
      { id: "a1", name: "Bio Ritmo", customImage: "/uploads/b.jpg" },
      { id: "a2", name: null, customImage: "/images/default.png" },
    ],
    total: 30,
  });
});

describe("getProfileArtistsHandler", () => {
  it("lists a page of 24 with normalized portraits and the next offset, no-store", async () => {
    const res = await getProfileArtistsHandler(request("?offset=0&q=rit"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      userId: "u1",
      artists: [
        { artistId: "a1", artistName: "Bio Ritmo", imageUrl: "/uploads/b.jpg" },
        { artistId: "a2", artistName: "Unknown artist", imageUrl: null },
      ],
      total: 30,
      next: 2,
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(contributed).toHaveBeenCalledWith("u1", { offset: 0, limit: 24, query: "rit" });
  });

  it("has no next page once the total is reached", async () => {
    contributed.mockResolvedValue({
      artists: [{ id: "a1", name: "X", customImage: null }],
      total: 25,
    });
    expect(await (await getProfileArtistsHandler(request("?offset=24"))).json()).toMatchObject({
      next: null,
    });
  });

  it("forwards the auth response", async () => {
    const changed = NextResponse.json({ status: "error", error: "x" }, { status: 409 });
    auth.mockResolvedValue(changed);
    expect(await getProfileArtistsHandler(request())).toBe(changed);
  });

  it("is 400 for a bad query", async () => {
    expect((await getProfileArtistsHandler(request("?offset=x"))).status).toBe(400);
    expect(contributed).not.toHaveBeenCalled();
  });

  it("is 503 when the database fails", async () => {
    contributed.mockRejectedValue(new Error("down"));
    const res = await getProfileArtistsHandler(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", error: "Could not load your artists" });
  });

  it("answers JSON 503 with CORS when authentication throws", async () => {
    auth.mockRejectedValue(new Error("user lookup failed"));
    const res = await getProfileArtistsHandler(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", error: "Could not load your artists" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
