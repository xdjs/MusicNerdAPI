import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({ ingest: vi.fn(), queue: vi.fn(), inspect: vi.fn() }));
vi.mock("@/lib/units/ingestSource", () => ({ ingestSource: mock.ingest }));
vi.mock("@/lib/units/queueUnitSync", () => ({ queueUnitSync: mock.queue }));
vi.mock("@/lib/chatPdf/inspectChatPdf", () => ({ inspectChatPdf: mock.inspect }));
const { ingestUploadInline } = await import("@/lib/units/ingestUploadInline");

const bytes = Buffer.from("bytes");
const input = (contentType: string) => ({ sourceId: "s1", artistId: "a1", bytes, contentType });

beforeEach(() => {
  mock.ingest.mockReset().mockResolvedValue({ units: 2 });
  mock.queue.mockReset().mockResolvedValue(true);
  mock.inspect.mockReset().mockResolvedValue(2);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("ingestUploadInline", () => {
  it("ingests a 2-page PDF inline with its bytes", async () => {
    await ingestUploadInline(input("application/pdf"));
    expect(mock.ingest).toHaveBeenCalledWith(
      { sourceKind: "vault", sourceId: "s1" },
      expect.objectContaining({ bytes, ocr: false, pdfTimeoutMs: 10_000 }),
    );
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("ingests a 40-page PDF inline", async () => {
    mock.inspect.mockResolvedValue(40);
    await ingestUploadInline(input("application/pdf"));
    expect(mock.ingest).toHaveBeenCalledOnce();
  });

  it("queues a 41-page PDF without ingesting", async () => {
    mock.inspect.mockResolvedValue(41);
    await ingestUploadInline(input("application/pdf"));
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(mock.queue).toHaveBeenCalledWith("a1");
  });

  it("queues a PDF too large to inspect", async () => {
    mock.inspect.mockRejectedValue(new Error("PDF exceeds read limit"));
    await ingestUploadInline(input("application/pdf"));
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(mock.queue).toHaveBeenCalledWith("a1");
  });

  it.each(["text/plain", "text/markdown", "application/json"])("ingests %s inline", async type => {
    await ingestUploadInline(input(type));
    expect(mock.ingest).toHaveBeenCalledWith(
      { sourceKind: "vault", sourceId: "s1" },
      expect.objectContaining({ bytes, ocr: false, pdfTimeoutMs: 10_000 }),
    );
    expect(mock.inspect).not.toHaveBeenCalled();
  });

  it("passes an abort signal to the ingest and the inspection", async () => {
    await ingestUploadInline(input("application/pdf"));
    expect(mock.ingest.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(mock.inspect.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it("queues when the document needs OCR", async () => {
    mock.ingest.mockResolvedValue({ units: 0, ocrPages: 0, embedded: false, skipped: "needs-ocr" });
    await ingestUploadInline(input("application/pdf"));
    expect(mock.queue).toHaveBeenCalledWith("a1");
  });

  it("queues when the outcome carries a failure", async () => {
    mock.ingest.mockResolvedValue({ units: 0, ocrPages: 0, embedded: false, failed: "extract" });
    await ingestUploadInline(input("application/pdf"));
    expect(mock.queue).toHaveBeenCalledWith("a1");
  });

  it("queues and warns with the id only when the ingest is aborted", async () => {
    mock.ingest.mockRejectedValue(new DOMException("secret text", "AbortError"));
    await ingestUploadInline(input("application/pdf"));
    expect(mock.queue).toHaveBeenCalledWith("a1");
    const warned = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(warned).toContain("s1");
    expect(warned).not.toContain("secret text");
  });

  it("does not queue after a clean inline ingest", async () => {
    await ingestUploadInline(input("text/plain"));
    expect(mock.queue).not.toHaveBeenCalled();
  });

  it("queues an image", async () => {
    await ingestUploadInline(input("image/png"));
    expect(mock.ingest).not.toHaveBeenCalled();
    expect(mock.queue).toHaveBeenCalledWith("a1");
  });

  it("queues and warns with the source id when ingestion throws", async () => {
    mock.ingest.mockRejectedValue(new Error("db down: secret text"));
    await ingestUploadInline(input("text/plain"));
    expect(mock.queue).toHaveBeenCalledWith("a1");
    const warned = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(warned).toContain("s1");
    expect(warned).not.toContain("secret text");
  });

  it("never rejects, even when queueing fails", async () => {
    mock.ingest.mockRejectedValue(new Error("db"));
    mock.queue.mockRejectedValue(new Error("queue down"));
    await expect(ingestUploadInline(input("text/plain"))).resolves.toBeUndefined();
  });
});
