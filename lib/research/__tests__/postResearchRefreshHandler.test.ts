import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  canEdit: vi.fn(),
  claim: vi.fn(),
  refresh: vi.fn(),
  operation: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist: m.canEdit }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/research/requestResearchRefresh", () => ({ requestResearchRefresh: m.refresh }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation: m.operation }));
const { postResearchRefreshHandler } = await import("@/lib/research/postResearchRefreshHandler");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const ARTIST = "50f23458-df64-4381-8042-7333e8b64531";
const req = () => new Request("https://api/x", { method: "POST" });
const body = async (res: Response) => ({ code: res.status, json: await res.json() });

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.auth.mockResolvedValue({ userId: "u1" });
  m.canEdit.mockResolvedValue(true);
  m.claim.mockResolvedValue({ id: "c1", userId: "u1" });
  m.refresh.mockResolvedValue("queued");
  m.operation.mockImplementation(async (_a, _o, fn) => fn());
});

describe("postResearchRefreshHandler", () => {
  it("400s a malformed id before anything else", async () => {
    expect((await postResearchRefreshHandler(req(), "nope")).status).toBe(400);
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("returns the 401 from authentication", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postResearchRefreshHandler(req(), ARTIST)).status).toBe(401);
    expect(m.canEdit).not.toHaveBeenCalled();
  });

  it("403s someone who can't edit the artist", async () => {
    m.canEdit.mockResolvedValueOnce(false);
    expect(await body(await postResearchRefreshHandler(req(), ARTIST))).toEqual({
      code: 403,
      json: { status: "error", error: "Not your artist" },
    });
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("runs the refresh inside an operation for the user and the claim, with CORS", async () => {
    const res = await postResearchRefreshHandler(req(), ARTIST);
    expect(await body(res)).toEqual({ code: 200, json: { status: "ok", message: "queued" } });
    expect(m.canEdit).toHaveBeenCalledWith("u1", ARTIST);
    expect(m.operation.mock.calls[0].slice(0, 2)).toEqual([
      ARTIST,
      { userId: "u1", expectedClaimId: "c1", trigger: "manual_refresh" },
    ]);
    expect(m.refresh).toHaveBeenCalledWith(ARTIST, "c1");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes a null claim for an unclaimed artist an admin refreshes", async () => {
    m.claim.mockResolvedValueOnce(undefined);
    await postResearchRefreshHandler(req(), ARTIST);
    expect(m.refresh).toHaveBeenCalledWith(ARTIST, null);
  });

  it("500s on any error, including a claim that changed mid-request", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.refresh.mockRejectedValueOnce(new OwnershipChangedError());
    expect(await body(await postResearchRefreshHandler(req(), ARTIST))).toEqual({
      code: 500,
      json: { status: "error", error: "Couldn't start that" },
    });
    error.mockRestore();
  });
});
