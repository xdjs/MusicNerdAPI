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
  it("classifies the actual fetched catalog destination while retaining its discovery URL", async () => {
    const discoveredUrl = "https://grimes.com/listen";
    const url = "https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA";
    fetchPageContent.mockResolvedValueOnce({ ...goodPage, resolvedUrl: url });
    const read = await readCandidates([hit(discoveredUrl)]);
    expect(read[0]).toMatchObject({ discoveredUrl, result: { url, type: "music" } });
  });
  it.each([
    "http://127.0.0.1/private",
    "https://user:pass@example.com/",
    "https://www.viberate.com/artist/grimes",
  ])("drops an unsafe or blocked final destination: %s", async resolvedUrl => {
    fetchPageContent.mockResolvedValueOnce({ ...goodPage, resolvedUrl });
    expect(await readCandidates([hit("https://example.com/redirect")])).toEqual([]);
  });
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
