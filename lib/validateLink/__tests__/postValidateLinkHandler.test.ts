import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAllLinks } = vi.hoisted(() => ({
  getAllLinks: vi.fn(),
}));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { postValidateLinkHandler } = await import("@/lib/validateLink/postValidateLinkHandler");

beforeEach(() => {
  getAllLinks.mockReset().mockResolvedValue([]);
  mockFetch.mockReset();
});

describe("postValidateLinkHandler", () => {
  it("returns 400 for missing url", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const response = await postValidateLinkHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for unsupported platform", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/unknown" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await postValidateLinkHandler(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ valid: false });
  });

  it("returns valid: true for a working YouTube link", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      url: "https://www.youtube.com/@artist",
      text: () => Promise.resolve("<html><title>Artist - YouTube</title></html>"),
    });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://www.youtube.com/@artist" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await postValidateLinkHandler(request);
    expect(await response.json()).toMatchObject({ valid: true });
  });

  it("returns valid: false for a 404", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404,
      url: "https://www.youtube.com/@nonexistent",
      text: () => Promise.resolve(""),
    });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://www.youtube.com/@nonexistent" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await postValidateLinkHandler(request);
    expect(await response.json()).toMatchObject({ valid: false });
  });

  it("returns valid: false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ url: "https://soundcloud.com/artist" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await postValidateLinkHandler(request);
    expect(await response.json()).toMatchObject({ valid: false });
  });
});
