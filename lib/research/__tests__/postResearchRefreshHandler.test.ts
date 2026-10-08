import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  validate: vi.fn(),
  claim: vi.fn(),
  refresh: vi.fn(),
  operation: vi.fn(),
}));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({ validateArtistEditRequest: m.validate }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/research/requestResearchRefresh", () => ({ requestResearchRefresh: m.refresh }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation: m.operation }));
const { postResearchRefreshHandler } = await import("@/lib/research/postResearchRefreshHandler");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const ARTIST = "50f23458-df64-4381-8042-7333e8b64531";
const req = (body?: string) =>
  new Request("https://api/x", { method: "POST", ...(body ? { body } : {}) });
const body = async (res: Response) => ({ code: res.status, json: await res.json() });

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.validate.mockResolvedValue({ artistId: ARTIST, userId: "u1" });
  m.claim.mockResolvedValue({ id: "c1", userId: "u1" });
  m.refresh.mockResolvedValue("queued");
  m.operation.mockImplementation(async (_a, _o, fn) => fn());
});

describe("postResearchRefreshHandler", () => {
  it("returns the validation error without refreshing", async () => {
    const forbidden = NextResponse.json(
      { status: "error", error: "Not your artist" },
      { status: 403 },
    );
    m.validate.mockResolvedValueOnce(forbidden);
    const request = req("{broken");
    expect(await postResearchRefreshHandler(request, "any")).toBe(forbidden);
    expect(m.validate).toHaveBeenCalledWith(request, "any");
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("runs the refresh inside an operation for the user and the claim, with CORS", async () => {
    const res = await postResearchRefreshHandler(req(), ARTIST);
    expect(await body(res)).toEqual({ code: 200, json: { status: "ok", message: "queued" } });
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

  it("passes the Lore-only mode through the same signed-in claim operation", async () => {
    const res = await postResearchRefreshHandler(req('{"mode":"lore-only"}'), ARTIST);
    expect(res.status).toBe(200);
    expect(m.validate).toHaveBeenCalledOnce();
    expect(m.operation.mock.calls[0].slice(0, 2)).toEqual([
      ARTIST,
      { userId: "u1", expectedClaimId: "c1", trigger: "manual_refresh" },
    ]);
    expect(m.refresh).toHaveBeenCalledWith(ARTIST, "c1", { mode: "lore-only" });
  });

  it.each(['{"mode":"full"}', '{"mode":42}', "{broken"])(
    "rejects an invalid optional body without queuing research: %s",
    async invalid => {
      expect((await postResearchRefreshHandler(req(invalid), ARTIST)).status).toBe(400);
      expect(m.refresh).not.toHaveBeenCalled();
    },
  );

  it("500s on any error, including a claim that changed mid-request", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.refresh.mockRejectedValueOnce(new OwnershipChangedError());
    expect(await body(await postResearchRefreshHandler(req(), ARTIST))).toEqual({
      code: 500,
      json: { status: "error", error: "Couldn't start that" },
    });
    error.mockRestore();
  });

  it("500s when validation throws, e.g. the user lookup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.validate.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    expect((await postResearchRefreshHandler(req(), ARTIST)).status).toBe(500);
    error.mockRestore();
  });
});
