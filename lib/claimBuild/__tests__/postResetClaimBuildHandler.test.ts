import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postResetClaimBuildHandler } from "@/lib/claimBuild/postResetClaimBuildHandler";

const mock = vi.hoisted(() => ({ validate: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mock.validate,
}));
vi.mock("@/lib/claimBuild/resetClaimBuild", () => ({
  resetClaimBuild: mock.reset,
}));

describe("postResetClaimBuildHandler", () => {
  const request = new Request("https://example.com/api/onboarding/abc/reset", { method: "POST" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the removed values on success", async () => {
    mock.validate.mockResolvedValue({ artistId: "abc", userId: "u1" });
    const removed = {
      steps: ["profiles", "vault"],
      links: { spotify: "123" },
      bio: "Old bio",
      doc: true,
      sources: 5,
      jobs: 1,
    };
    mock.reset.mockResolvedValue(removed);

    const res = await postResetClaimBuildHandler(request, "abc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", removed });
    expect(mock.reset).toHaveBeenCalledWith("abc");
  });

  it("returns 404 when the artist does not exist", async () => {
    mock.validate.mockResolvedValue({ artistId: "abc", userId: "u1" });
    mock.reset.mockResolvedValue(null);

    const res = await postResetClaimBuildHandler(request, "abc");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ status: "error", error: "Artist not found" });
  });

  it("forwards the auth error when not signed in", async () => {
    const authError = NextResponse.json(
      { status: "error", error: "Not signed in" },
      { status: 401 },
    );
    mock.validate.mockResolvedValue(authError);

    const res = await postResetClaimBuildHandler(request, "abc");
    expect(res.status).toBe(401);
  });

  it("returns empty removed when nothing was built", async () => {
    mock.validate.mockResolvedValue({ artistId: "abc", userId: "u1" });
    const removed = { steps: [], links: {}, bio: null, doc: false, sources: 0, jobs: 0 };
    mock.reset.mockResolvedValue(removed);

    const res = await postResetClaimBuildHandler(request, "abc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", removed });
  });

  it("carries CORS headers", async () => {
    mock.validate.mockResolvedValue({ artistId: "abc", userId: "u1" });
    mock.reset.mockResolvedValue({
      steps: [],
      links: {},
      bio: null,
      doc: false,
      sources: 0,
      jobs: 0,
    });

    const res = await postResetClaimBuildHandler(request, "abc");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
