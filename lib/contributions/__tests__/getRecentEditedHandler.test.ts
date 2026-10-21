import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getRecentEditedHandler } from "@/lib/contributions/getRecentEditedHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), image: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/contributions/listRecentEdited", () => ({ listRecentEdited: mock.list }));
vi.mock("@/lib/musicPlatform/getArtistImages", () => ({ getArtistImages: mock.image }));

const row = {
  ugcId: "u1",
  artistId: "a1",
  updatedAt: "2026-10-20T10:00:00",
  artistName: "Bio Ritmo",
  spotifyId: "s1",
  deezerId: null,
  customImage: null,
};
const signedOut = () =>
  NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "token-user" });
  mock.list.mockResolvedValue([row]);
  mock.image.mockResolvedValue(new Map([["a1", "https://i.scdn.co/a.jpg"]]));
});

describe("getRecentEditedHandler", () => {
  it("lists any user's recent artists by `userId` without authenticating, each with an image", async () => {
    const response = await getRecentEditedHandler(
      new Request("https://example.org/api/recentEdited?userId=other-user"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(mock.auth).not.toHaveBeenCalled();
    expect(mock.list).toHaveBeenCalledWith("other-user");
    expect(mock.image).toHaveBeenCalledWith([
      { id: "a1", customImage: null, spotify: "s1", deezer: null },
    ]);
    expect(await response.json()).toEqual({
      status: "ok",
      entries: [{ ...row, imageUrl: "https://i.scdn.co/a.jpg" }],
    });
  });

  it("falls back to the token's user, and to an empty list with neither", async () => {
    await getRecentEditedHandler(new Request("https://example.org/api/recentEdited"));
    expect(mock.list).toHaveBeenCalledWith("token-user");
    mock.auth.mockResolvedValue(signedOut());
    const response = await getRecentEditedHandler(
      new Request("https://example.org/api/recentEdited"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", entries: [] });
    expect(mock.list).toHaveBeenCalledTimes(1);
  });

  it("gives an artist without an image a null `imageUrl`", async () => {
    mock.image.mockResolvedValue(new Map());
    const response = await getRecentEditedHandler(
      new Request("https://example.org/api/recentEdited?userId=other-user"),
    );
    expect(await response.json()).toEqual({
      status: "ok",
      entries: [{ ...row, imageUrl: null }],
    });
  });

  it("answers an empty list with a 200 when the read fails, as the website did", async () => {
    mock.list.mockRejectedValue(new Error("db down"));
    const response = await getRecentEditedHandler(
      new Request("https://example.org/api/recentEdited?userId=other-user"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", entries: [] });
  });
});
