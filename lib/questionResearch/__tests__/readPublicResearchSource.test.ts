import { it, expect, vi, beforeEach } from "vitest";
import { readPublicResearchSource } from "@/lib/questionResearch/readPublicResearchSource";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: load,
}));
const source = {
  sourceId: "vault:11111111-1111-4111-8111-111111111111",
  revision: "a".repeat(64),
  text: "The original passage retains its surrounding qualification.",
  url: "https://example.com/record",
  curation: "approved",
  evidenceKind: "original_text",
  speaker: "unverified",
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue([source]);
});
it("reopens public saved originals with exact offsets", async () => {
  const r = await readPublicResearchSource("artist", source.sourceId, source.revision, 4, 256);
  expect(r.passage.text).toBe(source.text.slice(4));
  expect(r.passage.start).toBe(4);
});
it("does not silently substitute a changed original", async () => {
  await expect(
    readPublicResearchSource("artist", source.sourceId, "b".repeat(64), 0, 256),
  ).rejects.toMatchObject({ status: 409 });
});
it("does not expose a private or removed source", async () => {
  load.mockResolvedValue([]);
  await expect(
    readPublicResearchSource("artist", source.sourceId, source.revision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
});
