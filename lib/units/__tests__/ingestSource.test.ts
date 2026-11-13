import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ingestSource } from "@/lib/units/ingestSource";
import type { UnitDraft, UnitSourceInput } from "@/lib/units/types";

const mocks = vi.hoisted(() => ({
  loadUnitSource: vi.fn(),
  buildSourceUnits: vi.fn(),
  embedUnits: vi.fn(),
  writeSourceUnits: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/units/loadUnitSource", () => ({ loadUnitSource: mocks.loadUnitSource }));
vi.mock("@/lib/units/buildSourceUnits", () => ({ buildSourceUnits: mocks.buildSourceUnits }));
vi.mock("@/lib/units/embedUnits", () => ({ embedUnits: mocks.embedUnits }));
vi.mock("@/lib/units/writeSourceUnits", () => ({ writeSourceUnits: mocks.writeSourceUnits }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));

const REF = { sourceKind: "vault" as const, sourceId: "src-1" };
const tx = { execute: mocks.execute };

function source(extractedTextIsNull = false): UnitSourceInput {
  return {
    sourceKind: "vault",
    sourceId: "src-1",
    artistId: "artist-1",
    title: "Doc",
    url: "https://example.com/doc.pdf",
    sourceRevision: "rev-1",
    extractedTextIsNull,
    body: { kind: "pdf", bytes: new Uint8Array([1]) },
  };
}

function unit(i: number, text: string, ocr = false): UnitDraft {
  return { unitIndex: i, locator: `p.${i + 1}`, text, textHash: `h${i}`, tokens: 5, ocr };
}

function statementText(call: unknown[]): string {
  return JSON.stringify(call[0]);
}

describe("ingestSource", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    mocks.writeSourceUnits.mockImplementation(
      async (_tx: unknown, input: { units: unknown[] }) => input.units.length,
    );
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  test("writes units and embeddings for a text-layer PDF", async () => {
    const units = [unit(0, "one"), unit(1, "two")];
    const vectors = [[0.1], [0.2]];
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({ units, ocrPages: 0, truncated: false });
    mocks.embedUnits.mockResolvedValue(vectors);

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 2, ocrPages: 0, embedded: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.embedUnits).toHaveBeenCalledWith(["one", "two"], { signal: undefined });
    expect(mocks.writeSourceUnits).toHaveBeenCalledWith(tx, {
      sourceKind: "vault",
      sourceId: "src-1",
      artistId: "artist-1",
      sourceRevision: "rev-1",
      title: "Doc",
      url: "https://example.com/doc.pdf",
      units,
      embeddings: vectors,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("passes pdfTimeoutMs, signal and bytes through", async () => {
    const signal = new AbortController().signal;
    const bytes = new Uint8Array([9]);
    const input = source();
    mocks.loadUnitSource.mockResolvedValue(input);
    mocks.buildSourceUnits.mockResolvedValue({ units: [], ocrPages: 0, truncated: false });

    await ingestSource(REF, { bytes, signal, pdfTimeoutMs: 500 });

    expect(mocks.loadUnitSource).toHaveBeenCalledWith(REF, { bytes, signal });
    expect(mocks.buildSourceUnits).toHaveBeenCalledWith(input, { signal, pdfTimeoutMs: 500 });
  });

  test("skips embedding when embed is false", async () => {
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "one")],
      ocrPages: 0,
      truncated: false,
    });

    const outcome = await ingestSource(REF, { embed: false });

    expect(outcome).toEqual({ units: 1, ocrPages: 0, embedded: false });
    expect(mocks.embedUnits).not.toHaveBeenCalled();
    expect(mocks.writeSourceUnits.mock.calls[0][1].embeddings).toBeNull();
  });

  test("writes units without embeddings when embedding fails", async () => {
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "secret page text")],
      ocrPages: 0,
      truncated: false,
    });
    mocks.embedUnits.mockRejectedValue(new Error("gateway down"));

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 1, ocrPages: 0, embedded: false });
    expect(mocks.writeSourceUnits.mock.calls[0][1].embeddings).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0].join(" ");
    expect(message).toContain("vault");
    expect(message).toContain("src-1");
    expect(message).not.toContain("secret page text");
  });

  test("an all-empty PDF whose vision pass fails writes nothing and does not throw", async () => {
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({
      units: [],
      ocrPages: 0,
      failed: "vision",
      truncated: false,
    });

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({
      units: 0,
      ocrPages: 0,
      embedded: false,
      skipped: "no-text",
      failed: "vision",
    });
    expect(mocks.embedUnits).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.writeSourceUnits).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ units: [], embeddings: null }),
    );
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("a body of kind none clears stale units", async () => {
    mocks.loadUnitSource.mockResolvedValue({ ...source(), body: { kind: "none" } });
    mocks.buildSourceUnits.mockResolvedValue({ units: [], ocrPages: 0, truncated: false });

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 0, ocrPages: 0, embedded: false, skipped: "no-text" });
    expect(mocks.writeSourceUnits).toHaveBeenCalledTimes(1);
  });

  test("fills a null extracted_text once from OCR text", async () => {
    mocks.loadUnitSource.mockResolvedValue(source(true));
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "typed page"), unit(1, "scanned page", true)],
      ocrPages: 1,
      truncated: false,
    });
    mocks.embedUnits.mockResolvedValue([[0.1], [0.2]]);
    mocks.execute.mockResolvedValue([{ revision: "rev-2" }]);

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 2, ocrPages: 1, embedded: true });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.writeSourceUnits.mock.calls[0][1].sourceRevision).toBe("rev-2");
    expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.writeSourceUnits.mock.invocationCallOrder[0],
    );
    expect(statementText(mocks.execute.mock.calls[0])).toContain("returning");
    const text = statementText(mocks.execute.mock.calls[0]);
    expect(text).toContain("update artist_vault_sources v set extracted_text");
    expect(text).toContain("v.extracted_text is null");
    expect(text).toContain("typed page\\n\\nscanned page");
    expect(text).toContain("src-1");
  });

  test("does not touch extracted_text when it is already present or no page was OCR", async () => {
    mocks.loadUnitSource.mockResolvedValue(source(false));
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "scanned page", true)],
      ocrPages: 1,
      truncated: false,
    });
    mocks.embedUnits.mockResolvedValue([[0.1]]);
    await ingestSource(REF);

    mocks.loadUnitSource.mockResolvedValue(source(true));
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "typed page")],
      ocrPages: 0,
      truncated: false,
    });
    await ingestSource(REF);

    expect(mocks.execute).not.toHaveBeenCalled();
  });

  test("a vault row that no longer matches the update keeps the loaded revision", async () => {
    mocks.loadUnitSource.mockResolvedValue(source(true));
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "scanned page", true)],
      ocrPages: 1,
      truncated: false,
    });
    mocks.embedUnits.mockResolvedValue([[0.1]]);
    mocks.execute.mockResolvedValue([]);

    await ingestSource(REF);

    expect(mocks.writeSourceUnits.mock.calls[0][1].sourceRevision).toBe("rev-1");
  });

  test("a partial vision read writes units but leaves extracted_text null", async () => {
    mocks.loadUnitSource.mockResolvedValue(source(true));
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "scanned page", true)],
      ocrPages: 1,
      failed: "vision",
      truncated: false,
    });
    mocks.embedUnits.mockResolvedValue([[0.1]]);

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 1, ocrPages: 1, embedded: true, failed: "vision" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.writeSourceUnits.mock.calls[0][1].sourceRevision).toBe("rev-1");
  });

  test("a missing source is reported as skipped", async () => {
    mocks.loadUnitSource.mockResolvedValue(null);

    const outcome = await ingestSource(REF);

    expect(outcome).toEqual({ units: 0, ocrPages: 0, embedded: false, skipped: "not-found" });
    expect(mocks.buildSourceUnits).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  test("with ocr off, a document that needs OCR writes nothing and reports needs-ocr", async () => {
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "one")],
      ocrPages: 0,
      truncated: false,
      needsOcr: true,
    });

    const outcome = await ingestSource(REF, { ocr: false });

    expect(mocks.buildSourceUnits).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ocr: false }),
    );
    expect(outcome).toEqual({ units: 0, ocrPages: 0, embedded: false, skipped: "needs-ocr" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.embedUnits).not.toHaveBeenCalled();
  });

  test("database errors propagate", async () => {
    mocks.loadUnitSource.mockResolvedValue(source());
    mocks.buildSourceUnits.mockResolvedValue({
      units: [unit(0, "one")],
      ocrPages: 0,
      truncated: false,
    });
    mocks.embedUnits.mockResolvedValue([[0.1]]);
    mocks.writeSourceUnits.mockRejectedValue(new Error("db down"));

    await expect(ingestSource(REF)).rejects.toThrow("db down");
  });
});
