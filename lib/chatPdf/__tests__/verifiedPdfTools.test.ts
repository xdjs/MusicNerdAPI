import { beforeEach, expect, it, vi } from "vitest";
import { pdfTextHash } from "../pdfTextHash";
import type { ChatPdf, PdfPageManifest, PdfTextHooks, PdfTextLocator } from "../types";
const m = vi.hoisted(() => ({ load: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.load }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.read }));
const { createChatPdfTools } = await import("../createChatPdfTools");
const source: ChatPdf = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "archive.pdf",
  url: "https://example.test/archive.pdf",
  path: "archive.pdf",
  revision: "r1",
  claimId: null,
  size: 14,
};
const bytes = Buffer.from("%PDF-synthetic");
const originalSha256 = pdfTextHash(bytes);
const manifest: PdfPageManifest = {
  originalSha256,
  extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
  physicalPages: 2,
  pages: ["Account [1] with 😀.", "Later qualification."].map((text, i) => ({
    physicalPage: i + 1,
    text,
    sha256: pdfTextHash(text),
  })),
  extraction: {
    engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
    algorithm: "pdf-text-items-y-lines-v1",
    coverage: "all-physical-pages-text-layer",
    emptyTextPages: [],
    visualTextCompleteness: "unverified",
  },
};
const register: PdfTextHooks["onVerifiedTextRead"] = (source, manifest, n) => ({
  textPages: manifest.pages.map(page => {
    const start = 0,
      end = page.text.length,
      text = page.text,
      id = pdfTextHash(`${page.physicalPage}:${start}:${end}:${text}`);
    const exact =
      manifest.locator?.physicalPage === page.physicalPage ? manifest.locator : undefined;
    return {
      kind: "pdf-page-text",
      sourceId: source.id,
      revision: source.revision,
      n,
      title: source.title,
      url: source.url,
      text,
      start,
      end,
      sha256: pdfTextHash(text),
      readId: id,
      blocks: [
        {
          id,
          start,
          end,
          preview: text.slice(0, 160),
          contextIncomplete: true,
          readSha256: pdfTextHash(text),
          sha256: pdfTextHash(text),
        },
        ...(exact
          ? [
              {
                id: pdfTextHash(JSON.stringify(exact)),
                start: exact.start,
                end: exact.end,
                preview: page.text.slice(exact.start, exact.end),
                contextIncomplete: true,
                sha256: exact.sha256,
              },
            ]
          : []),
      ],
      originalSha256: manifest.originalSha256,
      physicalPage: page.physicalPage,
      physicalPages: manifest.physicalPages,
      pageSha256: page.sha256,
    };
  }),
});
function setup(callback = vi.fn(register), controller = new AbortController()) {
  const unavailable = vi.fn();
  const pdf = createChatPdfTools("artist", () => 1, controller.signal, "Read archive.pdf", {
    onVerifiedTextRead: callback,
    onTextUnavailable: unavailable,
  });
  return { pdf, callback, unavailable, controller };
}
const execute = (tool: any, input: any) =>
  tool.execute(input, { toolCallId: "call", messages: [] });
beforeEach(() => {
  vi.clearAllMocks();
  m.load.mockResolvedValue([structuredClone(source)]);
  m.read.mockResolvedValue({
    bytes,
    hash: originalSha256,
    pages: 2,
    textManifest: structuredClone(manifest),
  });
});
it("opt-in reads original-bound text, keeps full output for capture and sends native PDF plus compact text blocks", async () => {
  const { pdf, callback, unavailable } = setup();
  const output = await execute(pdf.tools.readNamedPdf, {
    filename: "archive.pdf",
  });
  expect(m.read).toHaveBeenCalledWith(source, expect.any(AbortSignal), {
    extractText: true,
  });
  expect(callback).toHaveBeenCalledTimes(1);
  expect(unavailable).not.toHaveBeenCalled();
  expect(output.textPages).toHaveLength(2);
  expect(output.textPages[0].blocks[0]).toHaveProperty("readSha256");
  const model = (await pdf.tools.readNamedPdf.toModelOutput!({
    output,
  } as any)) as any;
  const publicMetadata = JSON.parse(model.value[0].text);
  expect(publicMetadata.textPages[0].text).toBe(manifest.pages[0].text);
  expect(Object.keys(publicMetadata.textPages[0].blocks[0]).sort()).toEqual([
    "contextIncomplete",
    "end",
    "id",
    "start",
  ]);
  expect(model.value.find((part: any) => part.type === "file")).toMatchObject({
    type: "file",
    mediaType: "application/pdf",
    data: { type: "data", data: bytes.toString("base64") },
  });
  await expect(pdf.assertRegistered(output.textPages)).resolves.toBeUndefined();
});
it("legacy callback preserves ordinary native PDF flow without extraction opt-in", async () => {
  const callback = vi.fn();
  const pdf = createChatPdfTools("artist", () => 1, undefined, "archive.pdf", callback);
  const output = await execute(pdf.tools.readNamedPdf, {
    filename: "archive.pdf",
  });
  expect(m.read).toHaveBeenCalledWith(source, undefined);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(output).not.toHaveProperty("textPages");
  expect(output).not.toHaveProperty("textUnavailable");
});
it.each(["missing", "wrongOriginal", "wrongPage", "blank"])(
  "keeps %s text explicitly unavailable, never inventing page registrations",
  async mode => {
    const file = {
      bytes,
      hash: originalSha256,
      pages: 2,
      textManifest: structuredClone(manifest),
    };
    if (mode === "missing") delete (file as any).textManifest;
    if (mode === "wrongOriginal") file.textManifest.originalSha256 = "a".repeat(64);
    if (mode === "wrongPage") file.textManifest.pages[0].sha256 = "a".repeat(64);
    if (mode === "blank") file.textManifest.pages[0].text = "";
    m.read.mockResolvedValue(file);
    const { pdf, callback, unavailable } = setup();
    const output = await execute(pdf.tools.readNamedPdf, {
      filename: "archive.pdf",
    });
    expect(output.textUnavailable).toBe("verified_pdf_page_text_unavailable");
    expect(output.textPages).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(unavailable).toHaveBeenCalledTimes(1);
  },
);
const locator = (): PdfTextLocator => ({
  sourceId: source.id,
  revision: source.revision,
  originalSha256,
  physicalPage: 2,
  pageSha256: manifest.pages[1].sha256,
  start: 6,
  end: 19,
  sha256: pdfTextHash(manifest.pages[1].text.slice(6, 19)),
});
it("reopens exact hash-bound page window from a freshly read current original", async () => {
  const { pdf, callback } = setup();
  await execute(pdf.tools.searchPdfSources, { query: "archive" });
  const output = await execute(pdf.tools.readPdfSource, {
    sourceId: source.id,
    locator: locator(),
  });
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][1].locator).toEqual(locator());
  expect(output.textPages).toHaveLength(2);
  expect(output.textPages[1]).toMatchObject({
    physicalPage: 2,
    start: 0,
    end: manifest.pages[1].text.length,
    text: manifest.pages[1].text,
  });
  expect(output.reopened).toEqual({
    locator: locator(),
    blockIds: [pdfTextHash(JSON.stringify(locator()))],
  });
  expect(
    output.textPages[1].blocks.find((block: any) => block.id === output.reopened.blockIds[0]),
  ).toMatchObject({ start: 6, end: 19, sha256: locator().sha256 });
});
it.each(["sourceId", "revision", "originalSha256", "pageSha256", "sha256", "end"])(
  "rejects a stale locator %s without registration",
  async field => {
    const { pdf, callback } = setup();
    await execute(pdf.tools.searchPdfSources, { query: "archive" });
    const stale = {
      ...locator(),
      [field]: field === "end" ? 999 : "0".repeat(64),
    };
    const output = await execute(pdf.tools.readPdfSource, {
      sourceId: source.id,
      locator: stale,
    });
    expect(output.error).toBeDefined();
    expect(output.textPages).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
  },
);
it("selection identity is tied to this turn and all discovered PDF context is rechecked even for []", async () => {
  const { pdf } = setup();
  await execute(pdf.tools.searchPdfSources, { query: "archive" });
  await expect(pdf.assertRegistered([{ ...locator(), physicalPages: 2 }])).rejects.toThrow(
    "Unregistered",
  );
  const output = await execute(pdf.tools.readPdfSource, {
    sourceId: source.id,
  });
  await expect(pdf.assertRegistered(output.textPages)).resolves.toBeUndefined();
  await expect(
    pdf.assertRegistered([{ ...output.textPages[0], pageSha256: "a".repeat(64) }]),
  ).rejects.toThrow("Unregistered");
  m.load.mockResolvedValue([]);
  await expect(pdf.assertRegistered([])).rejects.toThrow("publication changed");
});
it("rejects callback replacement text, revocation during registration and cancellation", async () => {
  const corrupt = vi.fn(async (...args: Parameters<typeof register>) => {
    const result = await register(...args);
    result.textPages[0].text = "invented";
    return result;
  });
  let test = setup(corrupt);
  expect(
    (await execute(test.pdf.tools.readNamedPdf, { filename: "archive.pdf" })).error,
  ).toBeDefined();
  const revoke = vi.fn(async (...args: Parameters<typeof register>) => {
    const result = await register(...args);
    m.load.mockResolvedValue([]);
    return result;
  });
  test = setup(revoke);
  expect(
    (await execute(test.pdf.tools.readNamedPdf, { filename: "archive.pdf" })).error,
  ).toBeDefined();
  m.load.mockResolvedValue([source]);
  const controller = new AbortController();
  const cancel = vi.fn(async (...args: Parameters<typeof register>) => {
    controller.abort();
    return register(...args);
  });
  test = setup(cancel, controller);
  expect(
    (await execute(test.pdf.tools.readNamedPdf, { filename: "archive.pdf" })).error,
  ).toBeDefined();
  await expect(test.pdf.assertRegistered([])).rejects.toThrow();
});
it("preserves two-original and no-repeat attempt limits with extraction enabled", async () => {
  const { pdf } = setup();
  await execute(pdf.tools.readNamedPdf, { filename: "archive.pdf" });
  expect((await execute(pdf.tools.readNamedPdf, { filename: "archive.pdf" })).error).toMatch(
    /read limit/,
  );
  expect(m.read).toHaveBeenCalledTimes(1);
});
it.each(["missingPage", "narrowedPage", "missingExactBlock"])(
  "rejects %s capture registration rather than claim full native-PDF coverage",
  async mode => {
    const callback = vi.fn(async (...args: Parameters<typeof register>) => {
      const result = await register(...args);
      if (mode === "missingPage") result.textPages.pop();
      if (mode === "narrowedPage") {
        result.textPages[0].start = 1;
        result.textPages[0].text = result.textPages[0].text.slice(1);
        result.textPages[0].sha256 = pdfTextHash(result.textPages[0].text);
      }
      if (mode === "missingExactBlock")
        result.textPages[1].blocks = result.textPages[1].blocks.slice(0, 1);
      return result;
    });
    const { pdf } = setup(callback);
    const output = await execute(pdf.tools.readNamedPdf, {
      filename: "archive.pdf",
      ...(mode === "missingExactBlock" ? { locator: locator() } : {}),
    });
    expect(output.error).toBeDefined();
    expect(output.textPages).toBeUndefined();
  },
);
it("third distinct PDF cannot bypass the shared two-read admission bound", async () => {
  const corpus = [
    source,
    { ...source, id: "22222222-2222-4222-8222-222222222222" },
    { ...source, id: "33333333-3333-4333-8333-333333333333" },
  ];
  m.load.mockImplementation(async (_artist: string, id?: string) =>
    id ? corpus.filter(row => row.id === id) : corpus,
  );
  const { pdf } = setup();
  await execute(pdf.tools.searchPdfSources, { query: "archive" });
  for (const row of corpus.slice(0, 2))
    expect((await execute(pdf.tools.readPdfSource, { sourceId: row.id })).textPages).toHaveLength(
      2,
    );
  expect((await execute(pdf.tools.readPdfSource, { sourceId: corpus[2].id })).error).toMatch(
    /read limit/,
  );
  expect(m.read).toHaveBeenCalledTimes(2);
});
it("hash-bound follow-up resolves current eligibility and rereads without a discovery tool call", async () => {
  const { pdf } = setup();
  const output = await execute(pdf.tools.readPdfSource, {
    sourceId: source.id,
    locator: locator(),
  });
  expect(m.load).toHaveBeenNthCalledWith(1, "artist", source.id);
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(output.textPages).toHaveLength(2);
  expect(output.reopened.locator).toEqual(locator());
});
it("direct read without a locator still requires discovery", async () => {
  const { pdf } = setup();
  expect((await execute(pdf.tools.readPdfSource, { sourceId: source.id })).error).toBeDefined();
  expect(m.load).not.toHaveBeenCalled();
  expect(m.read).not.toHaveBeenCalled();
});
it.each(["revoked", "duplicate", "staleRevision", "forgedOriginalHash"])(
  "direct locator %s never returns native bytes or page text to the model",
  async mode => {
    const { pdf, callback } = setup();
    const hint = locator();
    if (mode === "revoked") m.load.mockResolvedValue([]);
    if (mode === "duplicate") m.load.mockResolvedValue([source, source]);
    if (mode === "staleRevision") hint.revision = "stale";
    if (mode === "forgedOriginalHash") hint.originalSha256 = "a".repeat(64);
    const output = await execute(pdf.tools.readPdfSource, {
      sourceId: source.id,
      locator: hint,
    });
    expect(output.error).toBeDefined();
    expect(output.textPages).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    if (mode !== "forgedOriginalHash") expect(m.read).not.toHaveBeenCalled();
    const model = (await pdf.tools.readPdfSource.toModelOutput!({
      output,
    } as any)) as any;
    expect(model.type).toBe("text");
    expect(JSON.stringify(model)).not.toContain(bytes.toString("base64"));
    expect(JSON.stringify(model)).not.toContain(manifest.pages[0].text);
  },
);
