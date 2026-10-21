import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  getArtistById: vi.fn(),
  findApprovedClaim: vi.fn(),
  getPublicArtistAbout: vi.fn(),
  submit: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mock.findApprovedClaim }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({
  getPublicArtistAbout: mock.getPublicArtistAbout,
}));
vi.mock("@/lib/bioCorrections/submitBioCorrection", () => ({ submitBioCorrection: mock.submit }));
const { postBioCorrectionHandler } = await import("@/lib/bioCorrections/postBioCorrectionHandler");

const id = "11111111-1111-4111-8111-111111111111";
const bio = "A verified biography of this artist.";
const send = (body: unknown = { reason: "incorrect", expectedBio: bio }, artistId = id) =>
  postBioCorrectionHandler(
    new Request("https://api.test/api", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    artistId,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "user" });
  mock.getArtistById.mockResolvedValue({ bio });
  mock.findApprovedClaim.mockResolvedValue({ id: "claim" });
  mock.submit.mockResolvedValue("created");
});

describe("postBioCorrectionHandler", () => {
  it("refuses an anonymous report before reading anything", async () => {
    mock.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await send()).status).toBe(401);
    expect(mock.getArtistById).not.toHaveBeenCalled();
  });

  it("files the report against the server's About as the signed-in account", async () => {
    const res = await send();
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "ok", success: true, duplicate: false });
    expect(mock.submit).toHaveBeenCalledWith(
      "user",
      id,
      expect.objectContaining({ reason: "incorrect" }),
      bio,
    );
  });

  it("compares the same sanitized About the profile shows", async () => {
    mock.getArtistById.mockResolvedValue({ bio: `${bio} ([Source](https://example.com))` });
    expect((await send()).status).toBe(201);
    expect(mock.submit).toHaveBeenCalledWith("user", id, expect.anything(), bio);
  });

  it("refuses a stale About, and an unclaimed artist with no directory About", async () => {
    const stale = await send({ reason: "incorrect", expectedBio: "Old bio" });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({
      status: "error",
      error: "This About has changed. Reload the profile before sending your suggestion.",
    });
    mock.findApprovedClaim.mockResolvedValue(undefined);
    mock.getPublicArtistAbout.mockResolvedValue(null);
    expect((await send()).status).toBe(409);
    expect(mock.submit).not.toHaveBeenCalled();
  });

  it("accepts a report on a current directory About", async () => {
    mock.findApprovedClaim.mockResolvedValue(undefined);
    mock.getPublicArtistAbout.mockResolvedValue({ bio, kind: "researched", sources: [] });
    expect((await send()).status).toBe(201);
  });

  it("answers a duplicate with 200 and the daily limit with 429", async () => {
    mock.submit.mockResolvedValue("duplicate");
    const duplicate = await send();
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ status: "ok", success: true, duplicate: true });
    mock.submit.mockResolvedValue("limited");
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      status: "error",
      error:
        "You have sent 10 reports in the past 24 hours. Please try again when an earlier report is more than 24 hours old.",
    });
  });

  it.each([
    [{ reason: "incorrect", expectedBio: bio }, "not-a-uuid", 400, "Invalid artist ID"],
    ["{", id, 400, "Invalid report"],
    [
      { reason: "invented", expectedBio: bio },
      id,
      400,
      "Choose a reason and enter valid details or a public source URL",
    ],
    [
      { reason: "other", details: "x".repeat(18_001), expectedBio: bio },
      id,
      413,
      "Report is too long",
    ],
  ])("refuses a bad request %#", async (body, artistId, status, error) => {
    const res = await send(body, artistId as string);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ status: "error", error });
  });

  it("a missing artist is a 404 and a failed save a 500", async () => {
    mock.getArtistById.mockResolvedValueOnce(undefined);
    expect((await send()).status).toBe(404);
    mock.submit.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    const failed = await send();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      status: "error",
      error: "Could not save your suggestion. Please try again.",
    });
  });

  it("answers a JSON 500 with CORS when the account lookup throws", async () => {
    mock.auth.mockRejectedValueOnce(new Error("pool exhausted"));
    const res = await send();
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not save your suggestion. Please try again.",
    });
    expect(mock.submit).not.toHaveBeenCalled();
  });
});
