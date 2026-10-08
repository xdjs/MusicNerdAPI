import { it, expect, vi } from "vitest";
import { persistResearchOriginals } from "@/lib/questionResearch/persistResearchOriginals";
import type { TransactionDb } from "@/lib/ownership/types";
import type { QuestionResearchState, DiscoveryOriginal } from "@/lib/questionResearch/types";
const state = { request: { evidenceNeed: "reporting" } } as QuestionResearchState;
const original: DiscoveryOriginal = {
  url: "https://artist.example/story",
  title: "Title",
  text: "Actual original text.",
  identity: "confirmed",
  destination: "lore",
  provenance: {
    kind: "original_text",
    provider: "web",
    speaker: "unverified",
    publisher: "artist.example",
    publishedAt: null,
    retrievedAt: "2026-10-06T00:00:00Z",
    truncated: false,
    limitations: [],
  },
};
it("does not resurface an explicitly declined candidate", async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([
      { id: "candidate", url: original.url, curation: "declined", identity: "confirmed" },
    ])
    .mockResolvedValueOnce([]);
  expect(
    await persistResearchOriginals({ execute } as unknown as TransactionDb, "artist", state, [
      original,
    ]),
  ).toEqual([]);
  expect(execute).toHaveBeenCalledTimes(2);
});
it("honors existing rejected Lore even if a search returns it again", async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "vault", url: original.url, status: "rejected" }]);
  expect(
    await persistResearchOriginals({ execute } as unknown as TransactionDb, "artist", state, [
      original,
    ]),
  ).toEqual([]);
  expect(execute).toHaveBeenCalledTimes(2);
});
it("retains a changed approved original as pending without overwriting its previous Lore", async () => {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([
      {
        id: "candidate",
        url: original.url,
        curation: "approved",
        identity: "confirmed",
        source_id: "vault",
        reviewed_revision: "old",
      },
    ])
    .mockResolvedValueOnce([{ id: "vault", url: original.url, status: "approved" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "new-evidence", provenance: original.provenance }]);
  const r = await persistResearchOriginals(
    { execute } as unknown as TransactionDb,
    "artist",
    state,
    [original],
  );
  expect(r).toMatchObject([
    { sourceId: "discovery:new-evidence", curation: "pending", text: original.text },
  ]);
  expect(execute).toHaveBeenCalledTimes(5);
});
