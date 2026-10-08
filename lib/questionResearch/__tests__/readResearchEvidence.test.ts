import { it, expect, vi, beforeEach } from "vitest";
import { readResearchEvidence } from "@/lib/questionResearch/readResearchEvidence";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({ authorizeArtistKnowledge: m.auth }));
const revision = "a".repeat(64);
const row = {
  id: "evidence",
  url: "https://example.com/original",
  destination: "lore",
  identity: "confirmed",
  curation: "pending",
  reviewed_revision: null,
  source_id: null,
  revision,
  original_text: "Exact 🥁 original words with qualifications.",
  provenance: {
    kind: "original_text",
    speaker: "unverified",
    publishedAt: null,
    retrievedAt: "2026-10-06T00:00:00Z",
    truncated: false,
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
});
it("returns exact UTF-16 text with stable original references", async () => {
  m.execute.mockResolvedValueOnce([row]);
  const r = await readResearchEvidence("artist", { kind: "service" }, "evidence", revision, 0, 256);
  expect(r.passage.text).toBe(row.original_text);
  expect(r.passage.end).toBe(row.original_text.length);
  expect(r.passage.curation).toBe("pending");
});
it.each(["declined", "wrong_artist", "incorrect"])(
  "does not return %s evidence to public research",
  async curation => {
    m.execute.mockResolvedValueOnce([{ ...row, curation }]);
    await expect(
      readResearchEvidence("artist", { kind: "service" }, "evidence", revision, 0, 256),
    ).rejects.toMatchObject({ status: 404 });
  },
);
it("keeps unresolved identity private, even with a known evidence id", async () => {
  m.execute.mockResolvedValueOnce([{ ...row, identity: "unresolved" }]);
  await expect(
    readResearchEvidence("artist", { kind: "service" }, "evidence", revision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
});
it("does not reopen an approved original after its Lore parent is removed", async () => {
  m.execute
    .mockResolvedValueOnce([{ ...row, curation: "approved", reviewed_revision: revision }])
    .mockResolvedValueOnce([]);
  await expect(
    readResearchEvidence("artist", { kind: "service" }, "evidence", revision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
});
it("allows current artists to inspect unresolved originals for review", async () => {
  m.execute.mockResolvedValueOnce([{ ...row, identity: "unresolved" }]);
  expect(
    (
      await readResearchEvidence(
        "artist",
        { kind: "artist", userId: "user" },
        "evidence",
        revision,
        0,
        256,
      )
    ).passage.text,
  ).toBe(row.original_text);
  expect(m.auth).toHaveBeenCalledWith(expect.anything(), "artist", "user");
});
it("never silently substitutes a different revision", async () => {
  m.execute.mockResolvedValueOnce([row]);
  await expect(
    readResearchEvidence("artist", { kind: "service" }, "evidence", "b".repeat(64), 0, 256),
  ).rejects.toMatchObject({ status: 409 });
});
