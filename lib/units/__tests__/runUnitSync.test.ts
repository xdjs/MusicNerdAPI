import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  list: vi.fn(),
  ingest: vi.fn(),
  embed: vi.fn(),
  execute: vi.fn(),
  txExecute: vi.fn(),
  saveProgress: vi.fn(),
  saveState: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/lib/units/listArtistUnitSources", () => ({ listArtistUnitSources: mock.list }));
vi.mock("@/lib/units/ingestSource", () => ({ ingestSource: mock.ingest }));
vi.mock("@/lib/units/embedUnits", () => ({ embedUnits: mock.embed }));
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: mock.execute,
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ execute: mock.txExecute }),
  },
}));
vi.mock("@/lib/research/saveJobProgress", () => ({ saveJobProgress: mock.saveProgress }));
vi.mock("@/lib/research/saveJobState", () => ({ saveJobState: mock.saveState }));
vi.mock("@/lib/research/completeResearchJob", () => ({ completeResearchJob: mock.complete }));
const { runUnitSync } = await import("@/lib/units/runUnitSync");

type Entry = {
  sourceKind: "vault" | "social" | "evidence";
  sourceId: string;
  sourceRevision: string | null;
  indexedRevision: string | null;
  needsEmbedding: boolean;
};
const entry = (sourceId: string, o: Partial<Entry> = {}): Entry => ({
  sourceKind: "vault",
  sourceId,
  sourceRevision: "r1",
  indexedRevision: "r1",
  needsEmbedding: false,
  ...o,
});
const job = (o: { cursor?: number; state?: Record<string, unknown> } = {}) =>
  ({
    id: "job-1",
    artistId: "artist-1",
    kind: "unit_sync",
    status: "running",
    cursor: o.cursor ?? 0,
    total: null,
    attempts: 1,
    state: o.state ?? { backfill: true },
    updatedAt: null,
    activityId: null,
  }) as const;

/** A SQL query object's text with its bound parameters, for asserting what was sent. */
const sqlOf = (q: { queryChunks: unknown[] }) =>
  q.queryChunks
    .map(c =>
      typeof c === "object" && c && "value" in c ? (c as { value: string[] }).value.join("") : "$",
    )
    .join("");

let now = 1_000_000;
const farDeadline = () => now + 600_000;

beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.ingest.mockResolvedValue({ units: 2, ocrPages: 0, embedded: true });
  mock.execute.mockResolvedValue([]);
  mock.txExecute.mockResolvedValue([]);
});

describe("runUnitSync", () => {
  it("ingests a source whose indexed revision is stale, with the job's parse budget and OCR", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { sourceRevision: "r2", indexedRevision: "r1" }),
      entry("s2", { sourceKind: "social", indexedRevision: null }),
    ]);
    await runUnitSync(job(), farDeadline());
    expect(mock.list).toHaveBeenCalledWith("artist-1");
    expect(mock.ingest).toHaveBeenCalledTimes(2);
    expect(mock.ingest).toHaveBeenNthCalledWith(
      1,
      { sourceKind: "vault", sourceId: "s1" },
      expect.objectContaining({ pdfTimeoutMs: 45_000, ocr: true, signal: expect.any(AbortSignal) }),
    );
    expect(mock.ingest).toHaveBeenNthCalledWith(
      2,
      { sourceKind: "social", sourceId: "s2" },
      expect.anything(),
    );
  });

  it("leaves a current, embedded source alone", async () => {
    mock.list.mockResolvedValue([entry("s1")]);
    await runUnitSync(job(), farDeadline());
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(mock.embed).not.toHaveBeenCalled();
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it("deletes the units of an orphan without ingesting it", async () => {
    mock.list.mockResolvedValue([
      entry("gone", { sourceKind: "evidence", sourceRevision: null, indexedRevision: "r1" }),
    ]);
    await runUnitSync(job(), farDeadline());
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(mock.execute).toHaveBeenCalledOnce();
    const q = mock.execute.mock.calls[0][0];
    expect(sqlOf(q)).toMatch(/delete from source_units where source_kind = \$ and source_id = \$/);
    expect(q.queryChunks).toEqual(expect.arrayContaining(["evidence", "gone"]));
  });

  it("re-embeds the units missing embeddings when the revision matches", async () => {
    mock.list.mockResolvedValue([entry("s1", { needsEmbedding: true })]);
    mock.execute.mockResolvedValue([
      { id: "u1", text: "first" },
      { id: "u2", text: "second" },
    ]);
    mock.embed.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const outcome = await runUnitSync(job(), farDeadline());
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(sqlOf(mock.execute.mock.calls[0][0])).toMatch(/order by unit_index/);
    expect(mock.embed).toHaveBeenCalledWith(["first", "second"], {
      signal: expect.any(AbortSignal),
    });
    expect(mock.txExecute).toHaveBeenCalledTimes(2);
    const [first, second] = mock.txExecute.mock.calls.map(c => c[0]);
    expect(sqlOf(first)).toMatch(
      /update source_units set embedding = \$::extensions.vector where id = \$/,
    );
    expect(first.queryChunks).toEqual(expect.arrayContaining(["[0.1,0.2]", "u1"]));
    expect(second.queryChunks).toEqual(expect.arrayContaining(["[0.3,0.4]", "u2"]));
    expect(outcome.done).toBe(true);
  });

  it("stops before the deadline with done false and saves the next cursor and total", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    const deadline = now + 30_000;
    mock.ingest.mockImplementation(async () => {
      now += 12_000;
      return { units: 1, ocrPages: 0, embedded: true };
    });
    const outcome = await runUnitSync(job(), deadline);
    // 0 s and 12 s start; at 24 s only 6 s remain, inside the 8 s reserve.
    expect(mock.ingest).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ progress: "units 2/3, failures 0", done: false });
    expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 2, {
      total: 3,
      state: { backfill: true, failures: 0 },
    });
    expect(mock.complete).not.toHaveBeenCalled();
  });

  it("resumes at the job's cursor and finishes with done true", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    const outcome = await runUnitSync(job({ cursor: 2, state: { failures: 1 } }), farDeadline());
    expect(mock.ingest).toHaveBeenCalledOnce();
    expect(mock.ingest.mock.calls[0][0]).toEqual({ sourceKind: "vault", sourceId: "s3" });
    expect(outcome).toEqual({ progress: "units 3/3, failures 1", done: true });
    expect(mock.saveState).toHaveBeenCalledWith("job-1", { failures: 1 });
    expect(mock.complete).toHaveBeenCalledWith("job-1");
    expect(mock.saveProgress).not.toHaveBeenCalled();
  });

  it("finishes an artist with nothing to index", async () => {
    mock.list.mockResolvedValue([]);
    expect(await runUnitSync(job(), farDeadline())).toEqual({
      progress: "units 0/0, failures 0",
      done: true,
    });
    expect(mock.complete).toHaveBeenCalledWith("job-1");
  });

  it("counts a thrown ingest and a failed outcome as failures and keeps going", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    mock.ingest
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ units: 1, ocrPages: 1, embedded: true, failed: "vision" })
      .mockResolvedValueOnce({ units: 1, ocrPages: 0, embedded: true });
    const outcome = await runUnitSync(job(), farDeadline());
    expect(mock.ingest).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ progress: "units 3/3, failures 2", done: true });
    expect(mock.saveState).toHaveBeenCalledWith("job-1", { backfill: true, failures: 2 });
  });

  it("counts a failed re-embed and keeps going", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { needsEmbedding: true }),
      entry("s2", { indexedRevision: null }),
    ]);
    mock.execute.mockResolvedValue([{ id: "u1", text: "first" }]);
    mock.embed.mockRejectedValue(new Error("gateway down"));
    const outcome = await runUnitSync(job(), farDeadline());
    expect(mock.txExecute).not.toHaveBeenCalled();
    expect(mock.ingest).toHaveBeenCalledOnce();
    expect(outcome.progress).toBe("units 2/2, failures 1");
  });

  it("waits for a longer slice when the budget cannot fit one source", async () => {
    mock.list.mockResolvedValue([entry("s1", { indexedRevision: null })]);
    const outcome = await runUnitSync(job(), now + 7_000);
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(outcome).toEqual({ progress: "units 0/1, failures 0", done: false, waiting: true });
    expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 0, {
      total: 1,
      state: { backfill: true, failures: 0 },
    });
  });
});
