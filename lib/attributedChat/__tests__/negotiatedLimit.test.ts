import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createAttributionRegistry } from "../createAttributionRegistry";
import { transformAttributedStream } from "../transformAttributedStream";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture(limit: 6000 | 12000) {
  const registry = createAttributionRegistry({
    artistId: "synthetic",
    turnId: "cap",
    maxTextCharacters: limit,
    assertCurrent: async () => {},
  });
  const ids = [4000, 4000, 4000, 1].map((length, i) => {
    const text = String.fromCharCode(65 + i).repeat(length),
      original = {
        sourceId: "pdf:one",
        revision: "r1",
        url: "https://example.test/source.pdf",
        text,
        kind: "pdf-page-text" as const,
        originalSha256: hash("original"),
        physicalPage: i + 1,
        physicalPages: 4,
        pageSha256: hash(text),
      };
    return registry.registerTextRead(original, {
      n: 1,
      title: "Synthetic",
      url: original.url,
      text,
    }).blocks[0].id;
  });
  return { registry, ids };
}
async function collect(stream: ReadableStream) {
  const reader = stream.getReader(),
    parts: any[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return parts;
}
it.each([6000, 12000] as const)(
  "keeps partial overflow explicit under negotiated%s",
  async limit => {
    const { registry, ids } = fixture(limit);
    const raw = new ReadableStream({
      start(c) {
        for (const id of ids)
          c.enqueue({
            type: "text-delta",
            id: "t",
            delta: JSON.stringify({ blocks: [id] }) + "\n",
          });
        c.enqueue({ type: "text-delta", id: "t", delta: '{"end":true}\n' });
        c.enqueue({ type: "finish", finishReason: "stop" });
        c.close();
      },
    });
    const parts = await collect(
      transformAttributedStream(raw as never, {
        registry,
        maxTextCharacters: limit,
        signal: new AbortController().signal,
      }),
    );
    expect(
      parts.filter(p => p.type === "data-attributed-passage").map(p => p.data.text.length),
    ).toEqual(limit === 12000 ? [4000, 4000, 4000] : [4000]);
    expect(parts.filter(p => p.type === "data-attributed-status").at(-1).data.state).toBe(
      "partial",
    );
  },
);
it("cancels a12000-cap selection after first complete passage without releasing later data", async () => {
  const { registry, ids } = fixture(12000);
  let cancelled = false;
  const raw = new ReadableStream({
    start(c) {
      c.enqueue({
        type: "text-delta",
        id: "t",
        delta: JSON.stringify({ blocks: [ids[0]] }) + "\n",
      });
    },
    cancel() {
      cancelled = true;
    },
  });
  const abort = new AbortController(),
    reader = transformAttributedStream(raw as never, {
      registry,
      maxTextCharacters: 12000,
      signal: abort.signal,
    }).getReader();
  const parts: any[] = [];
  while (!parts.some(p => p.type === "data-attributed-passage")) {
    const p = await reader.read();
    if (p.done) throw Error("No first passage");
    parts.push(p.value);
  }
  abort.abort();
  while (true) {
    const p = await reader.read();
    if (p.done) break;
    parts.push(p.value);
  }
  reader.releaseLock();
  expect(cancelled).toBe(true);
  expect(parts.filter(p => p.type === "data-attributed-passage")).toHaveLength(1);
  expect(parts.filter(p => p.type === "data-attributed-status").at(-1).data.state).toBe("stopped");
});
it.each([NaN, Infinity, 6001, 24000])(
  "rejects invalid internal limit%s before accepting a stream",
  value => {
    expect(() =>
      createAttributionRegistry({
        artistId: "a",
        turnId: "t",
        maxTextCharacters: value as 6000,
        assertCurrent: async () => {},
      }),
    ).toThrow("Unsupported");
    const { registry } = fixture(6000);
    expect(() =>
      transformAttributedStream(new ReadableStream(), {
        registry,
        maxTextCharacters: value as 6000,
        signal: new AbortController().signal,
      }),
    ).toThrow("Unsupported");
  },
);
