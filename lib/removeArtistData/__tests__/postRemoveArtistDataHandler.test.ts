import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { query: { users: { findFirst: m.user } } } }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/removeArtistData/removeArtistData", () => ({ removeArtistData: m.remove }));
const { postRemoveArtistDataHandler } =
  await import("@/lib/removeArtistData/postRemoveArtistDataHandler");

const post = (body: unknown = { artistId: "a1", siteName: "instagram" }) =>
  postRemoveArtistDataHandler(
    new Request("https://api.test/api/removeArtistData", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.user.mockResolvedValue({ isAdmin: false, isWhiteListed: true });
  m.remove.mockResolvedValue({ status: "success", message: "Artist data removed" });
});

describe("postRemoveArtistDataHandler", () => {
  it("lets a whitelisted user remove a link", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      message: "Artist data removed",
    });
    expect(m.remove).toHaveBeenCalledWith("a1", "instagram");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("lets an admin remove a link", async () => {
    m.user.mockResolvedValue({ isAdmin: true, isWhiteListed: false });
    expect((await post()).status).toBe(200);
  });

  it("403s a user who is neither, without writing", async () => {
    m.user.mockResolvedValue({ isAdmin: false, isWhiteListed: false });
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Unauthorized" });
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("403s the write's own failures with its message, as MusicNerdWeb did", async () => {
    m.remove.mockResolvedValue({ status: "error", message: "Invalid platform column" });
    const res = await post();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid platform column" });
  });

  it("passes 401 and 400 through and 500s when the user can't be read", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await post()).status).toBe(401);
    expect((await post({ artistId: "a1" })).status).toBe(400);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.user.mockRejectedValue(new Error("db"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    log.mockRestore();
  });
  it("answers a JSON 500 with CORS when signing in throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.auth.mockRejectedValueOnce(new Error("db down"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    log.mockRestore();
  });
});
