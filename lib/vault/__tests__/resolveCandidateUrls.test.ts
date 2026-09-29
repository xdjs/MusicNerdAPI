import { describe, it, expect, vi } from "vitest";
import { hit } from "@/lib/vault/__tests__/searchRun";

const { resolveRedirectUrl } = vi.hoisted(() => ({
  resolveRedirectUrl: vi.fn(async (url: string) =>
    url.includes("redirect") ? (url.includes("dead") ? null : "https://example.com/real") : url,
  ),
}));
vi.mock("@/lib/sources/resolveRedirectUrl", () => ({ resolveRedirectUrl }));
const { resolveCandidateUrls } = await import("@/lib/vault/resolveCandidateUrls");

describe("resolveCandidateUrls", () => {
  it("swaps redirects for their destination and drops any that don't resolve", async () => {
    const out = await resolveCandidateUrls([
      hit("https://example.com/a"),
      hit("https://g/redirect/1"),
      hit("https://g/redirect/dead"),
    ]);
    expect(out.map(r => r.url)).toEqual(["https://example.com/a", "https://example.com/real"]);
  });
});
