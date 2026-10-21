import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, contributed, latest } = vi.hoisted(() => ({
  auth: vi.fn(),
  contributed: vi.fn(),
  latest: vi.fn(),
}));
vi.mock("@/lib/profile/authenticateProfileRequest", () => ({ authenticateProfileRequest: auth }));
vi.mock("@/lib/profile/getContributedArtists", () => ({ getContributedArtists: contributed }));
vi.mock("@/lib/artistLatest/readArtistLatest", () => ({ readArtistLatest: latest }));
const { getProfileUpdatesHandler } = await import("@/lib/profile/getProfileUpdatesHandler");

const request = (query = "") => new Request(`https://x/api/profile/updates${query}`);
const card = (id: string, kind: string, date: string) => ({
  id,
  kind,
  title: "t",
  text: "x",
  date,
  imageUrl: null,
  imageCaption: "c",
  sourceUrl: null,
  sourceLabel: "s",
});
const coverage = (status: "checked" | "failed" | "missing", provider = "spotify") => [
  { provider, status, checkedAt: null, lastAttemptAt: null, stale: false },
];

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "u1" });
  contributed.mockReset().mockResolvedValue({
    artists: [
      { id: "a1", name: "Bio Ritmo", customImage: null },
      { id: "a2", name: null, customImage: null },
    ],
    total: 8,
  });
  latest.mockReset().mockImplementation(async (id: string) => ({
    items:
      id === "a1"
        ? [
            card("release:1", "release", "2026-10-03"),
            card("instagram:1", "instagram", "2026-10-02T00:00:00.000Z"),
            card("interview:1", "interview", "2026-10-01T00:00:00.000Z"),
          ]
        : [card("release:2", "release", "2026-10-04")],
    coverage: coverage("checked"),
    unavailable: false,
  }));
});

describe("getProfileUpdatesHandler", () => {
  it("merges up to two cards per artist, newest first, with artist-prefixed ids, no-store", async () => {
    const res = await getProfileUpdatesHandler(request("?offset=0&kind=All"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      userId: "u1",
      checked: 2,
      next: 2,
      unavailable: false,
      unavailableProviders: [],
    });
    expect(body.items.map((i: { id: string }) => i.id)).toEqual([
      "a2:release:2",
      "a1:release:1",
      "a1:instagram:1",
    ]);
    expect(body.items[0]).toMatchObject({ artistId: "a2", artistName: "Unknown artist" });
    expect(body.items[1]).toMatchObject({ artistId: "a1", artistName: "Bio Ritmo" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(contributed).toHaveBeenCalledWith("u1", { offset: 0, limit: 6 });
    expect(latest).toHaveBeenCalledWith("a1", "Bio Ritmo");
    expect(latest).toHaveBeenCalledWith("a2", "the artist");
  });

  it("filters by kind before taking two per artist", async () => {
    const body = await (await getProfileUpdatesHandler(request("?kind=Lore"))).json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["a1:interview:1"]);
  });

  it("ends paging at the total", async () => {
    contributed.mockResolvedValue({
      artists: [{ id: "a1", name: "X", customImage: null }],
      total: 7,
    });
    expect(await (await getProfileUpdatesHandler(request("?offset=6"))).json()).toMatchObject({
      checked: 7,
      next: null,
    });
  });

  it("names failed or missing providers", async () => {
    latest.mockImplementation(async (id: string) => ({
      items: [],
      coverage: id === "a1" ? coverage("missing", "inprocess") : coverage("failed", "spotify"),
      unavailable: true,
    }));
    expect(await (await getProfileUpdatesHandler(request())).json()).toMatchObject({
      unavailable: true,
      unavailableProviders: ["inprocess", "spotify"],
    });
  });

  it("reports null providers when Latest is unavailable without naming a provider", async () => {
    latest.mockImplementation(async () => ({ items: [], coverage: [], unavailable: true }));
    expect(await (await getProfileUpdatesHandler(request())).json()).toMatchObject({
      unavailable: true,
      unavailableProviders: null,
    });
  });

  it("drops future-dated, undated and repeated cards before taking two per artist", async () => {
    latest.mockImplementation(async (id: string) => ({
      items:
        id === "a1"
          ? [
              card("release:future", "release", "2999-01-01"),
              card("release:undated", "release", "soon"),
              card("release:1", "release", "2026-10-03"),
              card("release:1", "release", "2026-10-03"),
              card("release:old", "release", "2020-01-01"),
            ]
          : [],
      coverage: coverage("checked"),
      unavailable: false,
    }));
    const body = await (await getProfileUpdatesHandler(request())).json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["a1:release:1", "a1:release:old"]);
  });

  it("reports an unknown failure as null providers when one artist's read throws", async () => {
    latest.mockImplementationOnce(async () => {
      throw new Error("down");
    });
    const body = await (await getProfileUpdatesHandler(request())).json();
    expect(body).toMatchObject({ unavailable: true, unavailableProviders: null });
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["a2:release:2"]);
  });

  it("forwards the auth response", async () => {
    const changed = NextResponse.json({ status: "error", error: "x" }, { status: 409 });
    auth.mockResolvedValue(changed);
    expect(await getProfileUpdatesHandler(request())).toBe(changed);
  });

  it("is 400 for a bad query", async () => {
    expect((await getProfileUpdatesHandler(request("?kind=Nope"))).status).toBe(400);
    expect(contributed).not.toHaveBeenCalled();
  });

  it("is 503 when the artists cannot be read", async () => {
    contributed.mockRejectedValue(new Error("down"));
    const res = await getProfileUpdatesHandler(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", error: "Could not load artist updates" });
  });
});
