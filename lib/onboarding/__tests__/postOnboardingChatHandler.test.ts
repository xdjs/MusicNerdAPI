import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), canEdit: vi.fn(), claim: vi.fn(), turn: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/onboarding/runOnboardingTurn", () => ({ runOnboardingTurn: m.turn }));
const { postOnboardingChatHandler } = await import("@/lib/onboarding/postOnboardingChatHandler");

const ARTIST = "50f23458-df64-4381-8042-7333e8b64531";
const req = (body = '{"type":"open"}') => new Request("https://api/x", { method: "POST", body });

beforeEach(() => {
  m.auth.mockReset().mockResolvedValue({ userId: "u1" });
  m.canEdit.mockReset().mockResolvedValue(true);
  m.claim.mockReset().mockResolvedValue({ id: "c1", userId: "u1" });
  m.turn.mockReset().mockImplementation(async function* () {
    yield { kind: "complete" };
  });
});

describe("postOnboardingChatHandler", () => {
  it("streams the turn's events as server-sent events, with CORS", async () => {
    const res = await postOnboardingChatHandler(req(), ARTIST);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.text()).toBe('data: {"kind":"complete"}\n\n');
    expect(m.turn).toHaveBeenCalledWith(
      ARTIST,
      { type: "open" },
      { userId: "u1", expectedClaimId: "c1" },
    );
  });

  it("400s a bad artist id before authenticating", async () => {
    expect((await postOnboardingChatHandler(req(), "nope")).status).toBe(400);
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("returns authentication's 401", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postOnboardingChatHandler(req(), ARTIST)).status).toBe(401);
  });

  it("403s someone who can't edit the artist", async () => {
    m.canEdit.mockResolvedValueOnce(false);
    const res = await postOnboardingChatHandler(req(), ARTIST);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "error", error: "Not authorized" });
    expect(m.turn).not.toHaveBeenCalled();
  });

  it("400s a bad body after the edit check", async () => {
    const res = await postOnboardingChatHandler(req("{}"), ARTIST);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid turn" });
  });

  it("runs an unclaimed artist's turn (an admin's) under a null claim", async () => {
    m.claim.mockResolvedValueOnce(undefined);
    await (await postOnboardingChatHandler(req(), ARTIST)).text();
    expect(m.turn).toHaveBeenCalledWith(
      ARTIST,
      { type: "open" },
      { userId: "u1", expectedClaimId: null },
    );
  });
});
