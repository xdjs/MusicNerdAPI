import { expect, it } from "vitest";
import { createAttributionRegistry } from "@/lib/attributedChat/createAttributionRegistry";
import { registerPdfPages } from "@/lib/attributedChat/registerPdfPages";
import { pdfTextHash } from "../pdfTextHash";
import { serializePdfModelMetadata } from "../serializePdfModelMetadata";
it("keeps exact source text/IDs/offsets while storing shared identity once and deriving previews", () => {
  const source = {
    id: "11111111-1111-4111-8111-111111111111",
    revision: "r1",
    title: "fixture.pdf",
    url: "https://example.test/fixture.pdf",
    path: "fixture.pdf",
    size: 123,
    claimId: null,
  };
  const text = "Heading\nLiteral [1] and <script>😀</script>.\nA qualification.";
  const originalSha256 = pdfTextHash("synthetic original");
  const registry = createAttributionRegistry({
    artistId: "fixture",
    turnId: "fixture",
    assertCurrent: async () => {},
  });
  const registered = registerPdfPages(
    registry,
    source,
    {
      originalSha256,
      physicalPages: 1,
      pages: [{ physicalPage: 1, text, sha256: pdfTextHash(text) }],
    } as never,
    1,
  );
  const output = {
    sourceId: source.id,
    revision: source.revision,
    title: source.title,
    url: source.url,
    n: 1,
    pages: 1,
    sha256: originalSha256,
    ...registered,
  };
  const before = JSON.stringify(output);
  const compact = JSON.parse(serializePdfModelMetadata(output));
  expect(JSON.stringify(output)).toBe(before);
  expect(compact).toMatchObject({
    sourceId: source.id,
    revision: source.revision,
    url: source.url,
    n: 1,
    pages: 1,
    sha256: originalSha256,
  });
  const page = compact.textPages[0];
  expect(page.text).toBe(text);
  expect(page.physicalPage).toBe(1);
  expect(page.pageSha256).toBe(pdfTextHash(text));
  for (const key of [
    "sourceId",
    "revision",
    "n",
    "title",
    "url",
    "originalSha256",
    "physicalPages",
  ])
    expect(Object.hasOwn(page, key)).toBe(false);
  expect(page.blocks.map((b: any) => b.id)).toEqual(output.textPages[0].blocks.map(b => b.id));
  for (const [index, block] of page.blocks.entries()) {
    expect(Object.keys(block).sort()).toEqual(["contextIncomplete", "end", "id", "start"]);
    expect(text.slice(block.start, block.end).slice(0, 160)).toBe(
      output.textPages[0].blocks[index].preview,
    );
  }
  const restored = {
    ...page,
    sourceId: compact.sourceId,
    revision: compact.revision,
    n: compact.n,
    title: compact.title,
    url: compact.url,
    originalSha256: compact.sha256,
    physicalPages: compact.pages,
    blocks: page.blocks.map((block: any) => ({
      ...block,
      preview: page.text.slice(block.start - page.start, block.end - page.start).slice(0, 160),
    })),
  };
  const original = output.textPages[0];
  expect(restored).toEqual({
    kind: original.kind,
    sourceId: original.sourceId,
    revision: original.revision,
    n: original.n,
    title: original.title,
    url: original.url,
    originalSha256: original.originalSha256,
    physicalPage: original.physicalPage,
    physicalPages: original.physicalPages,
    pageSha256: original.pageSha256,
    start: original.start,
    end: original.end,
    text: original.text,
    blocks: original.blocks.map(({ id, start, end, preview, contextIncomplete }) => ({
      id,
      start,
      end,
      preview,
      contextIncomplete,
    })),
  });
});
