import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getArtistViewerHandler } from "@/lib/artistViewer/getArtistViewerHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), artist: vi.fn(), claim: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.artist }));
vi.mock("@/lib/artistViewer/findActiveClaim", () => ({ findActiveClaim: mock.claim }));

const artistId = "00000000-0000-4000-8000-000000000001";
const request = () => new Request(`https://api.musicnerd.test/api/artist/${artistId}/viewer`);

beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ userId: "u1" });
  mock.artist.mockResolvedValue({ id: artistId, addedBy: "u2" });
  mock.claim.mockResolvedValue(undefined);
});

describe("getArtistViewerHandler", () => {
  it("reports the caller's own pending claim and that someone else added the artist", async () => {
    mock.claim.mockResolvedValueOnce({ userId: "u1", status: "pending" });
    const res = await getArtistViewerHandler(request(), artistId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      claimStatus: "pending",
      addedByCaller: false,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("reports nothing for someone else's claim, and the caller as adder", async () => {
    mock.claim.mockResolvedValueOnce({ userId: "u2", status: "approved" });
    mock.artist.mockResolvedValueOnce({ id: artistId, addedBy: "u1" });
    expect(await (await getArtistViewerHandler(request(), artistId)).json()).toEqual({
      status: "ok",
      claimStatus: null,
      addedByCaller: true,
    });
  });

  it("answers 400 for an id that isn't a UUID", async () => {
    const res = await getArtistViewerHandler(request(), "nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "artistId must be a UUID" });
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it("forwards the sign-in check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await getArtistViewerHandler(request(), artistId)).status).toBe(401);
    expect(mock.artist).not.toHaveBeenCalled();
  });

  it("answers 404 for an artist that doesn't exist", async () => {
    mock.artist.mockResolvedValueOnce(undefined);
    expect((await getArtistViewerHandler(request(), artistId)).status).toBe(404);
  });

  it("answers a database failure with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.claim.mockRejectedValueOnce(new Error("db down"));
    expect((await getArtistViewerHandler(request(), artistId)).status).toBe(500);
  });
});
