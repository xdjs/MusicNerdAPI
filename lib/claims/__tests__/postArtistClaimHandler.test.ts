import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postArtistClaimHandler } from "@/lib/claims/postArtistClaimHandler";

const m = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn(), label: vi.fn(), discord: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/claims/createArtistClaim", () => ({ createArtistClaim: m.create }));
vi.mock("@/lib/claims/userLabel", () => ({ userLabel: m.label }));
vi.mock("@/lib/discord/sendDiscordMessage", () => ({ sendDiscordMessage: m.discord }));

const ID = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const req = () => new Request(`https://api/api/artist/${ID}/claim`, { method: "POST" });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.create.mockResolvedValue({ referenceCode: "MN-ABCD" });
  m.label.mockResolvedValue("a@example.test");
  m.discord.mockResolvedValue(undefined);
});

describe("postArtistClaimHandler", () => {
  it("files the caller's claim, tells the team and returns the code", async () => {
    const res = await postArtistClaimHandler(req(), ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", referenceCode: "MN-ABCD" });
    expect(m.create).toHaveBeenCalledWith("u1", ID);
    expect(m.discord).toHaveBeenCalledWith(
      `New claim request: MN-ABCD | Artist ID: ${ID} | User: a@example.test`,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is 409 when the profile already has an active claim", async () => {
    m.create.mockResolvedValueOnce("claimed");
    const res = await postArtistClaimHandler(req(), ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "This artist profile has already been claimed",
    });
    expect(m.discord).not.toHaveBeenCalled();
  });

  it("is 404 for an unknown artist", async () => {
    m.create.mockResolvedValueOnce("no_artist");
    const res = await postArtistClaimHandler(req(), ID);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Artist not found" });
  });

  it("is 400 for a non-UUID id", async () => {
    expect((await postArtistClaimHandler(req(), "nope")).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("forwards the sign-in check's 401", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postArtistClaimHandler(req(), ID)).status).toBe(401);
  });

  it("is 500 when the claim can't be saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.create.mockRejectedValueOnce(new Error("db down"));
    const res = await postArtistClaimHandler(req(), ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
