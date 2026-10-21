import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAllLinks, checkLinkPage } = vi.hoisted(() => ({
  getAllLinks: vi.fn(),
  checkLinkPage: vi.fn(),
}));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks }));
vi.mock("@/lib/validateLink/checkLinkPage", () => ({ checkLinkPage }));
const { postValidateLinkHandler } = await import("@/lib/validateLink/postValidateLinkHandler");

const post = (body: unknown) =>
  postValidateLinkHandler(
    new Request("https://api.test/api/validateLink", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getAllLinks.mockResolvedValue([]);
});

describe("postValidateLinkHandler", () => {
  it("checks the page of the first platform whose pattern matches", async () => {
    checkLinkPage.mockResolvedValue({ valid: false, reason: "mintsongs error page" });
    const res = await post({ url: "https://mintsongs.com/pete" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      valid: false,
      reason: "mintsongs error page",
    });
    expect(checkLinkPage.mock.calls[0][1].name).toBe("mintsongs");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("400s with MusicNerdWeb's reason for a missing URL or a body that isn't JSON", async () => {
    for (const body of [{}, { url: 5 }, "nope"]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: "error",
        error: "No URL provided",
        valid: false,
        reason: "No URL provided",
      });
    }
    expect(checkLinkPage).not.toHaveBeenCalled();
  });

  it("400s for a URL no platform reads", async () => {
    const res = await post({ url: "https://instagram.com/pete" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Unsupported platform or invalid URL",
      valid: false,
      reason: "Unsupported platform or invalid URL",
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
