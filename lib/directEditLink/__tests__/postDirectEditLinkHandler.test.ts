import { describe, it, expect, vi, beforeEach } from "vitest";

const { authenticateRequest, canEditArtist, extractArtistId, setArtistLink, clearArtistLink } =
  vi.hoisted(() => ({
    authenticateRequest: vi.fn(),
    canEditArtist: vi.fn(),
    extractArtistId: vi.fn(),
    setArtistLink: vi.fn(),
    clearArtistLink: vi.fn(),
  }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink }));
vi.mock("@/lib/artistLinks/ArtistLinkConflictError", () => ({
  ArtistLinkConflictError: class ArtistLinkConflictError extends Error {},
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const { postDirectEditLinkHandler } =
  await import("@/lib/directEditLink/postDirectEditLinkHandler");

const artistId = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  canEditArtist.mockReset().mockResolvedValue(true);
  extractArtistId.mockReset().mockResolvedValue({
    siteName: "instagram",
    cardPlatformName: "Instagram",
    id: "artist123",
  });
  setArtistLink.mockReset().mockResolvedValue({ oldValue: null, artistName: "Test" });
  clearArtistLink.mockReset().mockResolvedValue({ oldValue: "old123" });
});

describe("postDirectEditLinkHandler", () => {
  it("sets a link with a valid URL", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "set", url: "https://instagram.com/artist" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.siteName).toBe("instagram");
  });

  it("clears a link", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "clear", siteName: "instagram" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  it("returns 400 when url is missing for set", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "set" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when siteName is missing for clear", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "clear" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when extractArtistId returns null", async () => {
    extractArtistId.mockResolvedValueOnce(null);
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "set", url: "https://example.com/unknown" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 403 when not authorized", async () => {
    canEditArtist.mockResolvedValueOnce(false);
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ artistId, action: "set", url: "https://instagram.com/artist" }),
    });
    const response = await postDirectEditLinkHandler(request);
    expect(response.status).toBe(403);
  });
});
