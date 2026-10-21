import { beforeEach, expect, it, vi } from "vitest";
import { readResearchOriginal } from "@/lib/questionResearch/readResearchOriginal";
const m = vi.hoisted(() => ({ publicRead: vi.fn(), discoveryRead: vi.fn() }));
vi.mock("@/lib/questionResearch/readPublicResearchSource", () => ({
  readPublicResearchSource: m.publicRead,
}));
vi.mock("@/lib/questionResearch/readResearchEvidence", () => ({
  readResearchEvidence: m.discoveryRead,
}));
const artist = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const revision = "a".repeat(64);
const auth = { kind: "service" as const };
beforeEach(() => {
  vi.resetAllMocks();
  m.publicRead.mockResolvedValue({ status: "ok" });
  m.discoveryRead.mockResolvedValue({ status: "ok" });
});
it.each([
  `vault:${id}`,
  `social:${id}:caption`,
  `public_answer:${id}`,
  `latest:spotify:${revision}`,
])("reads %s through current public eligibility", async sourceId => {
  await readResearchOriginal(artist, auth, sourceId, revision, 2, 256);
  expect(m.publicRead).toHaveBeenCalledWith(artist, sourceId, revision, 2, 256);
  expect(m.discoveryRead).not.toHaveBeenCalled();
});
it("reads a discovery by its evidence UUID, with or without the prefix", async () => {
  await readResearchOriginal(artist, auth, `discovery:${id}`, revision, 0, 4000);
  await readResearchOriginal(artist, auth, id, revision, 0, 4000);
  expect(m.discoveryRead).toHaveBeenNthCalledWith(1, artist, auth, id, revision, 0, 4000);
  expect(m.discoveryRead).toHaveBeenNthCalledWith(2, artist, auth, id, revision, 0, 4000);
  expect(m.publicRead).not.toHaveBeenCalled();
});
it("rejects an unknown source identity, a bad revision or an unbounded window", async () => {
  for (const [sourceId, rev, start, max] of [
    [`interview:${id}`, revision, 0, 4000],
    [`vault:${id}`, "short", 0, 4000],
    [`vault:${id}`, revision, -1, 4000],
    [`vault:${id}`, revision, 0, 12001],
    [`vault:${id}`, revision, 0, 100],
  ] as const)
    await expect(
      readResearchOriginal(artist, auth, sourceId, rev, start, max),
    ).rejects.toMatchObject({
      status: 400,
    });
  expect(m.publicRead).not.toHaveBeenCalled();
  expect(m.discoveryRead).not.toHaveBeenCalled();
});
