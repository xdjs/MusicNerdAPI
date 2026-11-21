import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), artist: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/artistLinkSubmission/submitArtistLink", () => ({ submitArtistLink: m.submit }));
const { postArtistLinkHandler } = await import("@/lib/artistLinkSubmission/postArtistLinkHandler");

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const url = "https://www.instagram.com/p3t3rango/";
const post = (body: unknown = { url }) =>
  postArtistLinkHandler(
    new Request(`https://api.test/api/artist/${id}/links`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    id,
  );
const saved = { approved: false, siteName: "instagram", platformName: "Instagram", message: "m" };

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.artist.mockResolvedValue({ id });
  m.submit.mockResolvedValue(saved);
});

describe("postArtistLinkHandler", () => {
  it("submits the link as the signed-in user", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...saved });
    expect(m.submit).toHaveBeenCalledWith({ id }, "u1", url);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes 401 through, 400s a bad body and 404s an unknown artist", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await post()).status).toBe(401);
    expect((await post({})).status).toBe(400);
    m.artist.mockResolvedValueOnce(undefined);
    const missing = await post();
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ status: "error", error: "Artist not found" });
    expect(m.submit).not.toHaveBeenCalled();
  });

  it("returns a refusal with its status, and anything else as a 500", async () => {
    m.submit.mockResolvedValueOnce({
      status: 409,
      error: "This artist data has already been added",
    });
    const refused = await post();
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({
      status: "error",
      error: "This artist data has already been added",
    });
    m.submit.mockRejectedValueOnce(new Error("db down"));
    const failed = await post();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      status: "error",
      error: "Error adding artist data, please try again",
    });
  });
});
