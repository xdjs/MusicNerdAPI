import { createChatPdfTools } from "@/lib/chatPdf/createChatPdfTools";
import type { InferToolOutput } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ load: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.load }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.read }));

const pdf = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "archive.pdf",
  url: "https://example.org/archive.pdf",
  path: "artist/archive.pdf",
  size: 100,
  revision: "v1",
  claimId: "c1",
};
const context = { toolCallId: "t1", messages: [], context: {} };
beforeEach(() => {
  vi.clearAllMocks();
  m.load.mockResolvedValue([pdf]);
  m.read.mockResolvedValue({ bytes: Buffer.from("%PDF-synthetic"), pages: 2, hash: "hash1" });
});

it("does no PDF I/O until asked and discovers metadata without reading bytes", async () => {
  const tools = createChatPdfTools("artist", vi.fn(), undefined).tools;
  expect(m.load).not.toHaveBeenCalled();
  const result = await tools.searchPdfSources.execute!({ query: "archive" }, context);
  expect(result).toMatchObject({ sources: [{ sourceId: pdf.id, title: pdf.title }] });
  expect(m.read).not.toHaveBeenCalled();
});

it("reads original bytes without extracted text and supplies a file only to the model", async () => {
  const cite = vi.fn().mockReturnValue(1);
  const tools = createChatPdfTools("artist", cite, undefined).tools;
  await tools.searchPdfSources.execute!({ query: "archive" }, context);
  const output = (await tools.readPdfSource.execute!(
    { sourceId: pdf.id },
    context,
  )) as InferToolOutput<typeof tools.readPdfSource>;
  expect(output).toMatchObject({ n: 1, pages: 2, sha256: "hash1" });
  expect(JSON.stringify(output)).not.toContain("JVBER");
  const model = await tools.readPdfSource.toModelOutput!({
    output,
    input: { sourceId: pdf.id },
    toolCallId: "t1",
  });
  expect(model).toMatchObject({
    type: "content",
    value: [{ type: "text" }, { type: "file", mediaType: "application/pdf" }],
  });
  expect(cite).toHaveBeenCalledWith({ url: pdf.url, title: pdf.title });
});

it("denies forged or unapproved IDs before storage access", async () => {
  const tools = createChatPdfTools("artist", vi.fn(), undefined).tools;
  expect(await tools.readPdfSource.execute!({ sourceId: pdf.id }, context)).toHaveProperty("error");
  expect(m.read).not.toHaveBeenCalled();
});

it("denies revocation between discovery and reading", async () => {
  const tools = createChatPdfTools("artist", vi.fn(), undefined).tools;
  await tools.searchPdfSources.execute!({ query: "archive" }, context);
  m.load.mockResolvedValue([]);
  expect(await tools.readPdfSource.execute!({ sourceId: pdf.id }, context)).toHaveProperty("error");
  expect(m.read).not.toHaveBeenCalled();
});

it("does not supply bytes when publication, content or claim changes after reading", async () => {
  for (const records of [[], [{ ...pdf, revision: "v2" }], [{ ...pdf, claimId: "c2" }]]) {
    m.load.mockResolvedValue([pdf]);
    const tools = createChatPdfTools("artist", vi.fn().mockReturnValue(1), undefined).tools;
    await tools.searchPdfSources.execute!({ query: "archive" }, context);
    const output = (await tools.readPdfSource.execute!(
      { sourceId: pdf.id },
      context,
    )) as InferToolOutput<typeof tools.readPdfSource>;
    m.load.mockResolvedValue(records);
    const model = await tools.readPdfSource.toModelOutput!({
      output,
      input: { sourceId: pdf.id },
      toolCallId: "t1",
    });
    expect(JSON.stringify(model)).not.toContain('"type":"file"');
    expect(JSON.stringify(model)).toContain("unavailable");
  }
});

it("returns a bounded failure without citing an unread file", async () => {
  m.read.mockRejectedValue(new Error("timeout"));
  const cite = vi.fn();
  const tools = createChatPdfTools("artist", cite, undefined).tools;
  await tools.searchPdfSources.execute!({ query: "archive" }, context);
  expect(await tools.readPdfSource.execute!({ sourceId: pdf.id }, context)).toHaveProperty("error");
  expect(cite).not.toHaveBeenCalled();
});

it("rechecks retained PDF evidence before another model step", async () => {
  const session = createChatPdfTools("artist", vi.fn().mockReturnValue(1));
  await session.tools.searchPdfSources.execute!({ query: "archive" }, context);
  await session.tools.readPdfSource.execute!({ sourceId: pdf.id }, context);
  await expect(session.assertCurrent()).resolves.toBeUndefined();
  m.load.mockResolvedValue([]);
  await expect(session.assertCurrent()).rejects.toThrow("publication changed");
});

it("caps concurrent reads and never fetches the same document twice in a turn", async () => {
  const session = createChatPdfTools("artist", vi.fn().mockReturnValue(1));
  await session.tools.searchPdfSources.execute!({ query: "archive" }, context);
  await Promise.all([
    session.tools.readPdfSource.execute!({ sourceId: pdf.id }, context),
    session.tools.readPdfSource.execute!({ sourceId: pdf.id }, context),
  ]);
  expect(m.read).toHaveBeenCalledTimes(1);
});
