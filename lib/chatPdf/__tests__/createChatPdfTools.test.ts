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

it("reads one exact filename explicitly present in the latest question without discovery roundtrip", async () => {
  const session = createChatPdfTools(
    "artist",
    vi.fn().mockReturnValue(1),
    undefined,
    "What does archive.pdf say?",
  );
  const output = await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context);
  expect(output).toMatchObject({ n: 1, pages: 2, sourceId: pdf.id });
  expect(m.load).toHaveBeenNthCalledWith(
    1,
    "artist",
    undefined,
    "archive.pdf",
    true,
    "What does archive.pdf say?",
  );
  expect(m.read).toHaveBeenCalledTimes(1);
});

it("refuses inferred filenames, substrings, missing and ambiguous matches without reading", async () => {
  for (const question of [
    "What is his latest release?",
    "Read notarchive.pdf please",
    "Read archive.pdfx",
    "Read archive.pdf.exe",
  ]) {
    const session = createChatPdfTools("artist", vi.fn(), undefined, question);
    expect(
      await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
    ).toHaveProperty("error");
  }
  expect(m.load).not.toHaveBeenCalled();
  for (const rows of [[], [pdf, { ...pdf, id: "22222222-2222-4222-8222-222222222222" }]]) {
    m.load.mockResolvedValue(rows);
    const session = createChatPdfTools("artist", vi.fn(), undefined, "Read archive.pdf");
    expect(
      await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
    ).toHaveProperty("error");
  }
  expect(m.read).not.toHaveBeenCalled();
});

it("rejects named-file claim/content races before storage and revocation after storage", async () => {
  for (const after of [[], [{ ...pdf, claimId: "c2" }], [{ ...pdf, revision: "v2" }]]) {
    m.load.mockReset().mockResolvedValueOnce([pdf]).mockResolvedValue(after);
    const session = createChatPdfTools("artist", vi.fn(), undefined, "Read archive.pdf");
    expect(
      await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
    ).toHaveProperty("error");
  }
  expect(m.read).not.toHaveBeenCalled();
  m.load
    .mockReset()
    .mockResolvedValueOnce([pdf])
    .mockResolvedValueOnce([pdf])
    .mockResolvedValue([]);
  const cite = vi.fn();
  const session = createChatPdfTools("artist", cite, undefined, "Read archive.pdf");
  expect(
    await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
  ).toHaveProperty("error");
  expect(cite).not.toHaveBeenCalled();
});

it("shares duplicate/read quota and revalidates named-file bytes at conversion and next step", async () => {
  const session = createChatPdfTools(
    "artist",
    vi.fn().mockReturnValue(1),
    undefined,
    "Read archive.pdf",
  );
  const output = await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context);
  await session.tools.searchPdfSources.execute!({ query: "archive.pdf" }, context);
  expect(await session.tools.readPdfSource.execute!({ sourceId: pdf.id }, context)).toHaveProperty(
    "error",
  );
  expect(m.read).toHaveBeenCalledTimes(1);
  m.load.mockResolvedValue([]);
  const converted = await session.tools.readNamedPdf.toModelOutput!({
    output: output as InferToolOutput<typeof session.tools.readNamedPdf>,
    input: { filename: "archive.pdf" },
    toolCallId: "n",
  });
  expect(JSON.stringify(converted)).not.toContain('"type":"file"');
  await expect(session.assertCurrent()).rejects.toThrow("publication changed");
});

it("keeps the two-read cap shared across named reads and the two-step fallback", async () => {
  const files = [
    pdf,
    { ...pdf, id: "22222222-2222-4222-8222-222222222222", title: "second.pdf" },
    { ...pdf, id: "33333333-3333-4333-8333-333333333333", title: "third.pdf" },
  ];
  m.load.mockImplementation(async (_artist, id, query, exact) =>
    id ? files.filter(f => f.id === id) : exact ? files.filter(f => f.title === query) : files,
  );
  const session = createChatPdfTools(
    "artist",
    vi.fn().mockReturnValue(1),
    undefined,
    "Read archive.pdf",
  );
  await session.tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context);
  await session.tools.searchPdfSources.execute!({ query: "second" }, context);
  await session.tools.readPdfSource.execute!({ sourceId: files[1].id }, context);
  expect(
    await session.tools.readPdfSource.execute!({ sourceId: files[2].id }, context),
  ).toHaveProperty("error");
  expect(m.read).toHaveBeenCalledTimes(2);
});

it("fetches a named original only once across concurrent calls", async () => {
  const tools = createChatPdfTools(
    "artist",
    vi.fn().mockReturnValue(1),
    undefined,
    "Read archive.pdf",
  ).tools;
  await Promise.all([
    tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
    tools.readNamedPdf.execute!({ filename: "archive.pdf" }, context),
  ]);
  expect(m.read).toHaveBeenCalledTimes(1);
});
