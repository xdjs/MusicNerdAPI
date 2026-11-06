import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), add: vi.fn(), schedule: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/addArtist/addArtist", () => ({ addArtist: m.add }));
vi.mock("@/lib/addArtist/scheduleArtistAddedFollowUps", () => ({
  scheduleArtistAddedFollowUps: m.schedule,
}));
const { postAddArtistHandler } = await import("@/lib/addArtist/postAddArtistHandler");

const post = (body: unknown = { platformId: "s1" }) =>
  postAddArtistHandler(
    new Request("https://api.test/api/artist", { method: "POST", body: JSON.stringify(body) }),
  );
const body = { result: "created", artistId: "a1", artistName: "Radiohead", message: "Success!" };

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.add.mockResolvedValue({ body, created: { createdAt: "t", platformId: "s1" } });
});

describe("postAddArtistHandler", () => {
  it("adds the artist as the signed-in user and schedules the follow-ups", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", ...body });
    expect(m.add).toHaveBeenCalledWith("u1", {
      platformId: "s1",
      platform: "spotify",
      forceCreate: false,
    });
    expect(m.schedule).toHaveBeenCalledWith({
      origin: "https://api.test",
      userId: "u1",
      artistId: "a1",
      artistName: "Radiohead",
      platform: "spotify",
      platformId: "s1",
      createdAt: "t",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("schedules nothing for an outcome that created nothing", async () => {
    m.add.mockResolvedValueOnce({
      body: { result: "exists", artistId: "b", artistName: "R", message: "m" },
    });
    expect((await post()).status).toBe(200);
    expect(m.schedule).not.toHaveBeenCalled();
  });

  it("passes 401 through and 400s a bad body", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await post()).status).toBe(401);
    expect((await post({})).status).toBe(400);
    expect(m.add).not.toHaveBeenCalled();
  });

  it("returns a refusal with its status, a duplicate insert as 409, anything else as 500", async () => {
    m.add.mockResolvedValueOnce({ status: 404, error: "Could not find artist on spotify" });
    const missing = await post();
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      status: "error",
      error: "Could not find artist on spotify",
    });
    m.add.mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"));
    const dup = await post();
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({
      status: "error",
      error: "This artist is already in our database",
    });
    m.add.mockRejectedValueOnce(new Error("db down"));
    const failed = await post();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      status: "error",
      error: "Something went wrong on our end, please try again",
    });
  });
});
