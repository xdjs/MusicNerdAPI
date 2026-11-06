import { createHash } from "node:crypto";
import type { UIMessageChunk } from "ai";
import { expect, it } from "vitest";
import { createAttributionRegistry } from "../createAttributionRegistry";
import { registerPdfPages } from "../registerPdfPages";
import { transformAttributedStream } from "../transformAttributedStream";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const registry = createAttributionRegistry({
    artistId: "synthetic",
    turnId: "framing",
    assertCurrent: async () => {},
  });
  const pages = Array.from({ length: 24 }, (_, i) => {
    const text = `Literal physical page ${i + 1}.`;
    return { physicalPage: i + 1, text, sha256: hash(text) };
  });
  const output = registerPdfPages(
    registry,
    {
      id: "pdf",
      title: "Synthetic",
      url: "https://example.test/a.pdf",
      path: "a.pdf",
      size: 1,
      revision: "r1",
      claimId: null,
    },
    {
      originalSha256: hash("synthetic original"),
      physicalPages: 24,
      pages,
      extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
      extraction: {
        engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
        algorithm: "pdf-text-items-y-lines-v1",
        coverage: "all-physical-pages-text-layer",
        emptyTextPages: [],
        visualTextCompleteness: "unverified",
      },
    },
    1,
  );
  return { registry, ids: output.textPages.map(p => p.blocks[0].id) };
}
async function run(deltas: string[], registry: ReturnType<typeof createAttributionRegistry>) {
  const input = new ReadableStream({
    start(c) {
      for (const delta of deltas) c.enqueue({ type: "text-delta", id: "t", delta });
      c.enqueue({ type: "finish", finishReason: "stop" });
      c.close();
    },
  });
  const output: UIMessageChunk[] = [];
  const reader = transformAttributedStream(input as never, {
    registry,
    signal: new AbortController().signal,
  }).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const terminal = output.filter(p => p.type === "data-attributed-status").at(-1);
  return {
    passages: output.filter(p => p.type === "data-attributed-passage"),
    state: terminal && "data" in terminal ? terminal.data : undefined,
  };
}
it("valid record admission is independent of SDK delta grouping", async () => {
  const { registry, ids } = fixture();
  const records = ids.map(id => "   " + JSON.stringify({ blocks: [id] }) + "  \n");
  records.push('{"end":true}\n');
  expect(records.join("").length).toBeGreaterThan(2048);
  const grouped = await run([records.join("")], registry),
    split = await run(records, registry);
  expect(grouped.state).toMatchObject({ state: "complete-transport" });
  expect(grouped.passages).toHaveLength(24);
  expect(grouped).toEqual(split);
});
it.each([false, true])(
  "one oversized record still fails closed with fragmented=%s",
  async fragmented => {
    const { registry } = fixture(),
      record = "x".repeat(2049) + "\n";
    const result = await run(
      fragmented ? [record.slice(0, 1024), record.slice(1024)] : [record],
      registry,
    );
    expect(result.state).toMatchObject({ state: "failed" });
    expect(result.passages).toHaveLength(0);
  },
);
