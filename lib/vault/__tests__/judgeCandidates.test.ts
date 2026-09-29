import { describe, it, expect, vi } from "vitest";
import { goodPage, hit } from "@/lib/vault/__tests__/searchRun";

const { judgeSourceRelevance } = vi.hoisted(() => ({
  judgeSourceRelevance: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/relevance/judgeSourceRelevance", () => ({ judgeSourceRelevance }));
const { judgeCandidates } = await import("@/lib/vault/judgeCandidates");

describe("judgeCandidates", () => {
  it("hands the judge each page's own title and full text, and whether it's the artist's domain", async () => {
    const anchor = { name: "Pete Rango", catalog: [], identifiers: [] };
    await judgeCandidates(anchor, [
      {
        result: hit("https://peterango.com", "search title"),
        page: { ...goodPage, title: "Page" } as never,
      },
      {
        result: hit("https://example.com/a", "search title"),
        page: { ...goodPage, title: "" } as never,
      },
    ]);
    expect(judgeSourceRelevance).toHaveBeenCalledWith(anchor, [
      { url: "https://peterango.com", title: "Page", text: goodPage.fullText, ownDomain: true },
      { url: "https://example.com/a", title: "", text: goodPage.fullText, ownDomain: false },
    ]);
  });
});
