import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  urls: vi.fn(),
  findApprovedClaim: vi.fn(),
  insert: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/vault/getVaultSourceUrlsByArtistId", () => ({
  getVaultSourceUrlsByArtistId: mock.urls,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: mock.insert }));
vi.mock("@/lib/research/queueLoreRefresh", () => ({ queueLoreRefresh: mock.queue }));
const { postLoreSuggestionHandler } =
  await import("@/lib/loreSuggestions/postLoreSuggestionHandler");

const artistId = "8b3d9163-a184-468e-8772-cdd73f260835";
const call = (url: unknown, extra = {}, id = artistId) =>
  postLoreSuggestionHandler(
    new Request(`https://api.test/api/artist/${id}/lore-suggestions`, {
      method: "POST",
      body: JSON.stringify({ url, ...extra }),
    }),
    id,
  );
const provenance = { userId: "visitor-1", trigger: "visitor_suggestion", approveIfTrusted: true };

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "visitor-1" });
  mock.urls.mockResolvedValue([]);
  mock.findApprovedClaim.mockResolvedValue({ id: "claim-1" });
  mock.insert.mockImplementation(async (data: object) => ({ id: "source-1", ...data }));
  mock.queue.mockResolvedValue(true);
});

describe("postLoreSuggestionHandler", () => {
  it("a signed-in visitor's source waits for review", async () => {
    const res = await call(" pitchfork.com/features/bike-lane ");
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", success: true, sourceStatus: "pending" });
    expect(mock.insert).toHaveBeenCalledWith(
      {
        artistId,
        url: "https://pitchfork.com/features/bike-lane",
        title: "Source from pitchfork.com",
        type: "review",
        status: "pending",
      },
      provenance,
    );
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("a trusted contributor's approved source queues a Lore refresh under the claim read first", async () => {
    mock.insert.mockImplementation(async (data: object) => ({ ...data, status: "approved" }));
    const res = await call("https://www.example.com/interview");
    expect(await res.json()).toEqual({ status: "ok", success: true, sourceStatus: "approved" });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", title: "Source from example.com" }),
      provenance,
    );
    expect(mock.queue).toHaveBeenCalledWith(artistId, "claim-1", {
      userId: "visitor-1",
      trigger: "source_submission",
    });
    mock.findApprovedClaim.mockResolvedValue(undefined);
    await call("https://example.com/other");
    expect(mock.queue).toHaveBeenLastCalledWith(artistId, null, expect.any(Object));
  });

  it("ignores approval flags and identities supplied by the client", async () => {
    const res = await call("https://example.com/interview", {
      status: "approved",
      approveIfTrusted: false,
      userId: "admin",
    });
    expect(await res.json()).toMatchObject({ sourceStatus: "pending" });
    expect(mock.insert).toHaveBeenCalledWith(expect.anything(), provenance);
  });

  it("reports a saved approval truthfully when the Lore refresh can't queue", async () => {
    mock.insert.mockImplementation(async (data: object) => ({ ...data, status: "approved" }));
    mock.queue.mockImplementationOnce(async () => {
      throw new Error("queue unavailable");
    });
    const res = await call("https://example.com/interview");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      status: "ok",
      success: true,
      sourceStatus: "approved",
      warning:
        "Source saved and approved, but the Lore refresh could not start. An artist or admin can retry it. You do not need to submit again.",
    });
  });

  it("refuses a URL already in the vault, with or without its fragment", async () => {
    mock.urls.mockResolvedValue(["https://example.com/interview#part-2"]);
    const res = await call("https://example.com/interview");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      status: "error",
      error: "This source has already been suggested",
    });
    expect(mock.insert).not.toHaveBeenCalled();
    mock.urls.mockResolvedValue([]);
    mock.insert.mockResolvedValue(undefined);
    expect((await call("https://example.com/interview")).status).toBe(409);
  });

  it("refuses an anonymous caller, a bad id and a private URL", async () => {
    mock.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await call("https://example.com/a")).status).toBe(401);
    const bad = await call("https://example.com/a", {}, "nope");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ status: "error", error: "Invalid artist ID" });
    expect((await call("http://10.0.0.8/admin")).status).toBe(400);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("saves nothing and answers 500 when the write fails", async () => {
    mock.insert.mockImplementationOnce(async () => {
      throw new Error("role lookup unavailable");
    });
    const res = await call("https://example.com/interview");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not submit the source. Please try again.",
    });
    expect(mock.queue).not.toHaveBeenCalled();
  });
});
