import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  list: vi.fn(),
  ingest: vi.fn(),
  embed: vi.fn(),
  execute: vi.fn(),
  txExecute: vi.fn(),
  saveProgress: vi.fn(),
  finish: vi.fn(),
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
vi.mock("@/lib/units/saveUnitSyncProgress", () => ({ saveUnitSyncProgress: mock.saveProgress }));
vi.mock("@/lib/units/finishUnitSync", () => ({ finishUnitSync: mock.finish }));
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
  mock.finish.mockResolvedValue(true);
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

  it("bounds the PDF parse by the slice deadline, keeping 8 s to persist", async () => {
    mock.list.mockResolvedValue([entry("s1", { indexedRevision: null })]);
    await runUnitSync(job(), now + 30_000);
    expect(mock.ingest.mock.calls[0][1].pdfTimeoutMs).toBe(22_000);
  });

  it("does not start a source with less than 20 s left, keeping the cursor", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
    ]);
    mock.ingest.mockImplementation(async () => {
      now += 11_000;
      return { units: 1, ocrPages: 0, embedded: true };
    });
    // 0 s starts (30 s left); at 11 s only 19 s remain.
    const outcome = await runUnitSync(job(), now + 30_000);
    expect(mock.ingest).toHaveBeenCalledOnce();
    expect(outcome).toEqual({ progress: "units 1/2, failures 0", done: false });
    expect(mock.saveProgress.mock.calls[0][3].after).toEqual({
      sourceKind: "vault",
      sourceId: "s1",
    });
  });

  it("stops before the deadline with done false and saves the next cursor and total", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    const deadline = now + 40_000;
    mock.ingest.mockImplementation(async () => {
      now += 12_000;
      return { units: 1, ocrPages: 0, embedded: true };
    });
    const outcome = await runUnitSync(job(), deadline);
    // 0 s and 12 s start; at 24 s only 16 s remain, under the 20 s needed to start a source.
    expect(mock.ingest).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ progress: "units 2/3, failures 0", done: false });
    expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 2, 3, {
      backfill: true,
      failures: 0,
      after: { sourceKind: "vault", sourceId: "s2" },
    });
    expect(mock.finish).not.toHaveBeenCalled();
  });

  it("resumes after the saved key and finishes with done true", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    const after = { sourceKind: "vault", sourceId: "s2" };
    const outcome = await runUnitSync(
      job({ cursor: 2, state: { failures: 1, after } }),
      farDeadline(),
    );
    expect(mock.ingest).toHaveBeenCalledOnce();
    expect(mock.ingest.mock.calls[0][0]).toEqual({ sourceKind: "vault", sourceId: "s3" });
    expect(outcome).toEqual({ progress: "units 3/3, failures 1", done: true });
    expect(mock.finish).toHaveBeenCalledWith("job-1", {
      failures: 1,
      after: { sourceKind: "vault", sourceId: "s3" },
    });
    expect(mock.saveProgress).not.toHaveBeenCalled();
  });

  it("does not skip a source when an orphan before the cursor was deleted between slices", async () => {
    // Slice 1 deleted the orphan "e-gone" and processed "s1"; the list now starts one shorter.
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    const after = { sourceKind: "vault", sourceId: "s1" };
    await runUnitSync(job({ cursor: 2, state: { after } }), farDeadline());
    expect(mock.ingest.mock.calls.map(c => c[0].sourceId)).toEqual(["s2", "s3"]);
  });

  it("resumes after a saved key that has itself disappeared, in kind-then-id order", async () => {
    mock.list.mockResolvedValue([
      entry("e1", { sourceKind: "evidence", indexedRevision: null }),
      entry("p2", { sourceKind: "social", indexedRevision: null }),
      entry("v1", { indexedRevision: null }),
    ]);
    const after = { sourceKind: "social", sourceId: "p1" };
    await runUnitSync(job({ state: { after } }), farDeadline());
    expect(mock.ingest.mock.calls.map(c => c[0].sourceId)).toEqual(["p2", "v1"]);
  });

  it("finishes an artist with nothing to index", async () => {
    mock.list.mockResolvedValue([]);
    expect(await runUnitSync(job(), farDeadline())).toEqual({
      progress: "units 0/0, failures 0",
      done: true,
    });
    expect(mock.finish).toHaveBeenCalledWith("job-1", { backfill: true, failures: 0 });
  });

  it("counts a thrown ingest and a failed outcome as failures and keeps going", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { indexedRevision: null }),
      entry("s2", { indexedRevision: null }),
      entry("s3", { indexedRevision: null }),
    ]);
    mock.ingest
      .mockRejectedValueOnce(
        Object.assign(new Error("Failed query: insert …\nparams: secret unit text"), {
          name: "DrizzleQueryError",
          cause: { code: "57P01" },
        }),
      )
      .mockResolvedValueOnce({ units: 1, ocrPages: 1, embedded: true, failed: "vision" })
      .mockResolvedValueOnce({ units: 1, ocrPages: 0, embedded: true });
    const outcome = await runUnitSync(job(), farDeadline());
    expect(mock.ingest).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ progress: "units 3/3, failures 2", done: true });
    expect(mock.finish).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        backfill: true,
        failures: 2,
        after: { sourceKind: "vault", sourceId: "s3" },
      }),
    );
    const logged = vi
      .mocked(console.warn)
      .mock.calls.map(c => c.join(" "))
      .join("\n");
    expect(logged).toContain("vault source s1 failed: DrizzleQueryError 57P01");
    expect(logged).not.toContain("secret unit text");
    expect(logged).not.toContain("Failed query");
  });

  it("counts a failed re-embed and keeps going", async () => {
    mock.list.mockResolvedValue([
      entry("s1", { needsEmbedding: true }),
      entry("s2", { indexedRevision: null }),
    ]);
    mock.execute.mockResolvedValue([{ id: "u1", text: "first" }]);
    mock.embed.mockRejectedValue(new Error("gateway down: first"));
    const outcome = await runUnitSync(job(), farDeadline());
    expect(mock.txExecute).not.toHaveBeenCalled();
    expect(mock.ingest).toHaveBeenCalledOnce();
    expect(outcome.progress).toBe("units 2/2, failures 1");
    const logged = vi
      .mocked(console.warn)
      .mock.calls.map(c => c.join(" "))
      .join("\n");
    expect(logged).toContain("vault source s1 failed: Error");
    expect(logged).not.toContain("first");
  });

  it("waits for a longer slice when the budget cannot fit one source", async () => {
    mock.list.mockResolvedValue([entry("s1", { indexedRevision: null })]);
    const outcome = await runUnitSync(job(), now + 19_999);
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(outcome).toEqual({ progress: "units 0/1, failures 0", done: false, waiting: true });
    expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 0, 1, { backfill: true, failures: 0 });
  });

  describe("a source whose read was cut short (aborted)", () => {
    it("is not stamped, not counted, and is retried first in the next slice", async () => {
      mock.list.mockResolvedValue([
        entry("s1", { indexedRevision: null }),
        entry("s2", { indexedRevision: null }),
        entry("s3", { indexedRevision: null }),
      ]);
      mock.ingest
        .mockResolvedValueOnce({ units: 1, ocrPages: 0, embedded: true })
        .mockResolvedValueOnce({ units: 0, ocrPages: 0, embedded: false, skipped: "aborted" });
      const outcome = await runUnitSync(job({ state: {} }), farDeadline());
      expect(mock.ingest).toHaveBeenCalledTimes(2);
      expect(mock.ingest.mock.calls[1][1]).toMatchObject({ stampPartial: false });
      expect(outcome).toEqual({ progress: "units 1/3, failures 0", done: false });
      expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 1, 3, {
        failures: 0,
        after: { sourceKind: "vault", sourceId: "s1" },
        retry: { sourceKind: "vault", sourceId: "s2" },
      });
    });

    it("is retried once with stampPartial, which keeps today's partial write and counts a failure", async () => {
      mock.list.mockResolvedValue([
        entry("s1"),
        entry("s2", { indexedRevision: null }),
        entry("s3", { indexedRevision: null }),
      ]);
      mock.ingest
        .mockResolvedValueOnce({ units: 3, ocrPages: 3, embedded: true, failed: "vision" })
        .mockResolvedValueOnce({ units: 1, ocrPages: 0, embedded: true });
      const retry = { sourceKind: "vault", sourceId: "s2" };
      const after = { sourceKind: "vault", sourceId: "s1" };
      const outcome = await runUnitSync(job({ state: { after, retry } }), farDeadline());
      expect(mock.ingest.mock.calls.map(c => [c[0].sourceId, c[1].stampPartial])).toEqual([
        ["s2", true],
        ["s3", false],
      ]);
      expect(outcome.done).toBe(true);
      // The retry is spent, whatever its outcome.
      expect(mock.finish.mock.calls[0][1]).not.toHaveProperty("retry");
      expect(mock.finish.mock.calls[0][1].failures).toBe(1);
    });
  });

  describe("rescan (a source queued while the job was live)", () => {
    it("starts over from the top once when a rescan is pending at the end, then completes", async () => {
      // s0 was added while the job was live; it sorts before the saved key.
      mock.list
        .mockResolvedValueOnce([entry("s1"), entry("s2", { indexedRevision: null })])
        .mockResolvedValueOnce([entry("s0", { indexedRevision: null }), entry("s1"), entry("s2")]);
      mock.finish.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const after = { sourceKind: "vault", sourceId: "s1" };
      const outcome = await runUnitSync(job({ state: { after, rescan: true } }), farDeadline());
      expect(mock.ingest.mock.calls.map(c => c[0].sourceId)).toEqual(["s2", "s0"]);
      expect(mock.list).toHaveBeenCalledTimes(2);
      expect(mock.finish).toHaveBeenCalledTimes(2);
      // The flag is the database's to clear: the slice never writes it back.
      expect(mock.finish.mock.calls[0][1]).not.toHaveProperty("rescan");
      expect(mock.finish.mock.calls[1][1]).toEqual({
        failures: 0,
        after: { sourceKind: "vault", sourceId: "s2" },
      });
      expect(outcome).toEqual({ progress: "units 3/3, failures 0", done: true });
    });

    it("restarts at most once per slice and leaves a second rescan to the next slice", async () => {
      mock.list.mockResolvedValue([entry("s1")]);
      mock.finish.mockResolvedValue(false);
      const outcome = await runUnitSync(job({ state: {} }), farDeadline());
      expect(mock.finish).toHaveBeenCalledTimes(2);
      expect(outcome.done).toBe(false);
      // The next slice starts from the top: no resume key is saved.
      expect(mock.saveProgress).toHaveBeenCalledWith("job-1", 0, 1, { failures: 0 });
    });

    it("saves progress without the flag, which the database keeps", async () => {
      mock.list.mockResolvedValue([entry("s1", { indexedRevision: null }), entry("s2")]);
      mock.ingest.mockImplementation(async () => {
        now += 600_000;
        return { units: 1, ocrPages: 0, embedded: true };
      });
      await runUnitSync(job({ state: { rescan: true } }), farDeadline());
      expect(mock.saveProgress.mock.calls[0][3]).not.toHaveProperty("rescan");
    });
  });
});
