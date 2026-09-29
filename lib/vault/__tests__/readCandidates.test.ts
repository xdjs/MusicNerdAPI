import { describe, it, expect, vi } from "vitest";
import { goodPage, hit } from "@/lib/vault/__tests__/searchRun";

const { fetchPageContent } = vi.hoisted(() => ({
  fetchPageContent: vi.fn(async (url: string) =>
    url.includes("short")
      ? { ...goodPage, resolvedUrl: "https://www.linkedin.com/in/grimes" }
      : goodPage,
  ),
}));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent }));
const { readCandidates } = await import("@/lib/vault/readCandidates");

describe("readCandidates", () => {
  it("fetches every candidate with the verification timeout and drops LinkedIn destinations", async () => {
    const read = await readCandidates([
      hit("https://example.com/a"),
      hit("https://example.com/short"),
    ]);
    expect(fetchPageContent).toHaveBeenCalledWith("https://example.com/a", { timeoutMs: 8000 });
    expect(read.map(r => r.result.url)).toEqual(["https://example.com/a"]);
    expect(read[0].page).toEqual(goodPage);
  });
});
