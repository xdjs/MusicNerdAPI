import { expect, it, vi } from "vitest";
import { goodPage, hit, searchRun } from "@/lib/vault/__tests__/searchRun";

const h = vi.hoisted(() => ({ fetch: vi.fn(), judge: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: h.fetch }));
vi.mock("@/lib/vault/resolveCandidateUrls", () => ({
  resolveCandidateUrls: async (hits: unknown) => hits,
}));
vi.mock("@/lib/vault/judgeCandidates", () => ({ judgeCandidates: h.judge }));
vi.mock("@/lib/vault/fileCandidate", () => ({ fileCandidate: h.file }));
const { processDiscoveryCandidates } = await import("@/lib/vault/processDiscoveryCandidates");

it("keeps the real YouTube redirect gate out of judging and filing while retaining an article redirect", async () => {
  const video = hit("https://www.youtube.com/watch?v=fixture", "Svaneborg Kardyb live");
  const article = hit("https://magazine.example/old", "Svaneborg Kardyb interview");
  const finalUrl = "https://magazine.example/interview";
  h.fetch.mockResolvedValueOnce({
    ...goodPage,
    resolvedUrl:
      "https://www.google.com/sorry/index?continue=https://www.youtube.com/watch?v=fixture",
    status: 429,
    extractedText: null,
  });
  h.fetch.mockResolvedValueOnce({ ...goodPage, resolvedUrl: finalUrl });
  h.judge.mockResolvedValue(new Map());
  await processDiscoveryCandidates(
    searchRun({ artistName: "Svaneborg Kardyb" }),
    [video, article],
    new Set(),
    { name: "Svaneborg Kardyb" },
  );
  expect(h.judge.mock.calls[0][1]).toHaveLength(1);
  expect(h.file).toHaveBeenCalledTimes(1);
  expect(h.file.mock.calls[0][1]).toMatchObject({
    discoveredUrl: article.url,
    result: { url: finalUrl, title: article.title },
  });
});
