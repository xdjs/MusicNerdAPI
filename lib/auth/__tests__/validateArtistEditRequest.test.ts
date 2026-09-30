import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), canEdit: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
const { validateArtistEditRequest } = await import("@/lib/auth/validateArtistEditRequest");

const ARTIST = "50f23458-df64-4381-8042-7333e8b64531";
const req = () => new Request("https://api/x", { method: "POST" });
const error = async (res: unknown) => {
  expect(res).toBeInstanceOf(NextResponse);
  const r = res as NextResponse;
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  return { code: r.status, json: await r.json() };
};

beforeEach(() => {
  m.auth.mockReset().mockResolvedValue({ userId: "u1" });
  m.canEdit.mockReset().mockResolvedValue(true);
});

describe("validateArtistEditRequest", () => {
  it("returns the artist and the signed-in user who may edit it", async () => {
    expect(await validateArtistEditRequest(req(), ARTIST)).toEqual({
      artistId: ARTIST,
      userId: "u1",
    });
    expect(m.canEdit).toHaveBeenCalledWith("u1", ARTIST);
  });

  it("400s an id that isn't a UUID before authenticating", async () => {
    expect(await error(await validateArtistEditRequest(req(), "nope"))).toEqual({
      code: 400,
      json: { status: "error", error: "artistId must be a UUID" },
    });
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("returns the 401 from authentication", async () => {
    const unauthorized = NextResponse.json(
      { status: "error", error: "Not signed in" },
      { status: 401 },
    );
    m.auth.mockResolvedValueOnce(unauthorized);
    expect(await validateArtistEditRequest(req(), ARTIST)).toBe(unauthorized);
    expect(m.canEdit).not.toHaveBeenCalled();
  });

  it("403s someone who can't edit the artist", async () => {
    m.canEdit.mockResolvedValueOnce(false);
    expect(await error(await validateArtistEditRequest(req(), ARTIST))).toEqual({
      code: 403,
      json: { status: "error", error: "Not your artist" },
    });
  });
});
