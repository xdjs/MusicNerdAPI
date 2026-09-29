import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveRedirectUrl } from "@/lib/sources/resolveRedirectUrl";

const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";

afterEach(() => vi.unstubAllGlobals());

describe("resolveRedirectUrl", () => {
  it("passes a normal URL through without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveRedirectUrl("https://a.example/x")).toBe("https://a.example/x");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a grounding redirect to its destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: "https://a.example/real" })),
    );
    expect(await resolveRedirectUrl(redirect)).toBe("https://a.example/real");
  });

  it("drops a redirect that can't be resolved to a safe, real destination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: redirect })),
    );
    expect(await resolveRedirectUrl(redirect)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: "http://169.254.169.254/" })),
    );
    expect(await resolveRedirectUrl(redirect)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(await resolveRedirectUrl(redirect)).toBeNull();
  });
});
