import { beforeEach, expect, it, vi } from "vitest";
import type { IngestOutcome, UnitSyncEntry } from "@/lib/units/types";

const { listArtistUnitSources, ingestSource } = vi.hoisted(() => ({
  listArtistUnitSources: vi.fn(),
  ingestSource: vi.fn(),
}));
vi.mock("@/lib/units/listArtistUnitSources", () => ({ listArtistUnitSources }));
vi.mock("@/lib/units/ingestSource", () => ({ ingestSource }));
const { runUnitsBackfill } = await import("@/lib/evals/runUnitsBackfill");

const entry = (id: string, over: Partial<UnitSyncEntry> = {}): UnitSyncEntry => ({
  sourceKind: "vault",
  sourceId: id,
  sourceRevision: "r",
  indexedRevision: "r",
  needsEmbedding: false,
  ...over,
});
const outcome = (over: Partial<IngestOutcome> = {}): IngestOutcome => ({
  units: 2,
  ocrPages: 0,
  embedded: true,
  ...over,
});
const notBlocked = { blocked: () => false };

beforeEach(() => {
  listArtistUnitSources.mockReset();
  ingestSource.mockReset();
});

it("ingests stale sources and re-ingests current ones missing embeddings, leaving the rest and orphans", async () => {
  listArtistUnitSources
    .mockResolvedValueOnce([
      entry("current"),
      entry("stale", { indexedRevision: null }),
      entry("vectorless", { needsEmbedding: true }),
      entry("orphan", { sourceRevision: null, needsEmbedding: true }),
    ])
    .mockResolvedValueOnce([entry("current"), entry("stale"), entry("vectorless")]);
  ingestSource.mockResolvedValue(outcome());
  const result = await runUnitsBackfill("artist", notBlocked);
  expect(ingestSource.mock.calls.map(([ref]) => ref.sourceId)).toEqual(["stale", "vectorless"]);
  expect(ingestSource).toHaveBeenCalledWith(
    { sourceKind: "vault", sourceId: "vectorless" },
    expect.objectContaining({ ocr: true }),
  );
  expect(result).toEqual({
    sources: 4,
    ingested: 2,
    failed: 0,
    unitsWritten: 4,
    embeddedFalse: 0,
    noText: 0,
    stale: 0,
  });
});

it("counts units written without vectors and the sources still stale after the run", async () => {
  const vectorless = entry("vectorless", { needsEmbedding: true });
  listArtistUnitSources.mockResolvedValueOnce([vectorless]).mockResolvedValueOnce([vectorless]);
  ingestSource.mockResolvedValue(outcome({ embedded: false }));
  expect(await runUnitsBackfill("artist", notBlocked)).toMatchObject({
    ingested: 1,
    embeddedFalse: 1,
    stale: 1,
  });
});

it("leaves sources found to have no text out of the stale count", async () => {
  const empty = entry("empty", { indexedRevision: null });
  const gone = entry("gone", { indexedRevision: null });
  listArtistUnitSources.mockResolvedValue([empty, gone]);
  ingestSource
    .mockResolvedValueOnce(outcome({ units: 0, embedded: false, skipped: "no-text" }))
    .mockResolvedValueOnce(outcome({ units: 0, embedded: false, skipped: "not-found" }));
  expect(await runUnitsBackfill("artist", notBlocked)).toMatchObject({
    ingested: 0,
    failed: 0,
    noText: 2,
    stale: 0,
  });
});

it("counts failures, thrown errors and sources skipped once the budget blocks", async () => {
  const stale = (id: string) => entry(id, { indexedRevision: null });
  listArtistUnitSources.mockResolvedValue([stale("a"), stale("b"), stale("c")]);
  ingestSource
    .mockResolvedValueOnce(outcome({ failed: "vision" }))
    .mockRejectedValueOnce(new Error("boom"));
  let calls = 0;
  const result = await runUnitsBackfill("artist", { blocked: () => ++calls > 2 });
  expect(ingestSource).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({ ingested: 0, failed: 3, stale: 3 });
});
