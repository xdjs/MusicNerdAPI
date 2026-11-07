import { describe, expect, it, vi } from "vitest";
import { createAttributionRegistry } from "../createAttributionRegistry";
import { getAttributionFamily } from "../getAttributionFamily";
import { transformAttributedStream } from "../transformAttributedStream";

const original = (overrides = {}) => ({
  sourceId: "vault:one",
  revision: "r1",
  text: "Heading\nLiteral [footnote] and 😀.\nGoverning qualification.",
  url: "https://example.test/a",
  truncated: false,
  ...overrides,
});
function setup(overrides = {}, current = vi.fn(async () => {})) {
  const registry = createAttributionRegistry({
    artistId: "artist",
    turnId: "turn",
    assertCurrent: current,
  });
  const source = original(overrides);
  const result = registry.registerTextRead(source, {
    n: 1,
    title: "Source",
    url: source.url,
    text: source.text,
  });
  return { registry, result, source, current };
}
const raw = (chunks: object[]) =>
  new ReadableStream({
    start(c) {
      chunks.forEach(x => c.enqueue(x));
      c.close();
    },
  });
const text = (s: string) => ({ type: "text-delta", id: "t", delta: s });
const finish = { type: "finish", finishReason: "stop" };
const selector = (id: string) => JSON.stringify({ blocks: [id] }) + "\n";
async function run(
  chunks: object[],
  registry: ReturnType<typeof createAttributionRegistry>,
  signal = new AbortController().signal,
) {
  const out = [];
  const reader = transformAttributedStream(raw(chunks) as never, {
    registry,
    signal,
  }).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  reader.releaseLock();
  return out as any[];
}
const passages = (out: any[]) => out.filter(x => x.type === "data-attributed-passage");
const status = (out: any[]) =>
  out.filter(x => x.type === "data-attributed-status").at(-1)?.data.state;

describe("route without artist names or oracle state", () => {
  it.each([
    "What was the first album made with a collaborator?",
    "Which years did this artist use each alias?",
    "What other names has the artist released music under?",
  ])("routes %s", q => expect(getAttributionFamily(q)).not.toBeNull());
  it.each([
    "What instrument do they play?",
    "Why is the first paragraph hard to read?",
    "What is their favorite food?",
  ])("preserves ordinary %s", q => expect(getAttributionFamily(q)).toBeNull());
});
describe("read-bound registry", () => {
  it("binds the entire read window and retains literal context", async () => {
    const { registry, result, source } = setup();
    const records = await registry.resolve([result.blocks[0].id], new AbortController().signal);
    expect(records[0].text).toBe(source.text);
    expect(records[0].coverage).toBe("complete-read");
    expect(result.blocks[0]).not.toHaveProperty("text");
  });
  it("rejects invented text, unsafe URLs, unpaired Unicode and invalid ranges", () => {
    const { registry, source } = setup();
    for (const text of ["invented", "\ud800"])
      expect(() =>
        registry.registerTextRead(source, {
          n: 1,
          title: "x",
          url: source.url,
          text,
        }),
      ).toThrow();
    expect(() => setup({ url: "javascript:alert(1)" })).toThrow();
    expect(() =>
      registry.registerTextRead(source, {
        n: 1,
        title: "x",
        url: source.url,
        text: source.text,
        start: 1,
        end: source.text.length,
      }),
    ).toThrow();
  });
  it("rejects foreign-turn IDs and stale revisions", async () => {
    const { registry, result, current } = setup();
    const other = createAttributionRegistry({
      artistId: "artist",
      turnId: "other",
      assertCurrent: async () => {},
    });
    await expect(
      other.resolve([result.blocks[0].id], new AbortController().signal),
    ).rejects.toThrow();
    current.mockRejectedValueOnce(new Error("withdrawn"));
    await expect(
      registry.resolve([result.blocks[0].id], new AbortController().signal),
    ).rejects.toThrow();
  });
  it("checks abort again after asynchronous permission checks", async () => {
    const controller = new AbortController();
    const { registry, result } = setup(
      {},
      vi.fn(async () => {
        controller.abort();
      }),
    );
    await expect(registry.resolve([result.blocks[0].id], controller.signal)).rejects.toThrow();
  });
  it("marks partial windows as partial rather than complete evidence", async () => {
    const { registry, source } = setup();
    const result = registry.registerTextRead(source, {
      n: 1,
      title: "x",
      url: source.url,
      text: source.text.slice(0, 7),
      start: 0,
      end: 7,
    });
    const record = (await registry.resolve([result.blocks[0].id], new AbortController().signal))[0];
    expect(record.coverage).toBe("partial-read");
  });
  it("never supplies PDF passage IDs from metadata or unverified extracted text", () => {
    const { registry } = setup();
    expect(registry.notePdfUnavailable()).toEqual({
      blocks: [],
      unavailable: "verified_pdf_page_text_unavailable",
    });
  });
});
describe("incremental fail-closed stream", () => {
  it("emits literal bundles and only marks completed transport at successful EOF", async () => {
    const { registry, result, source } = setup();
    const out = await run(
      [{ type: "start" }, text(selector(result.blocks[0].id)), text('{"end":true}\n'), finish],
      registry,
    );
    expect(passages(out)[0].data.text).toBe(source.text);
    expect(status(out)).toBe("complete-transport");
    expect(out.some(x => ["text-delta", "file", "reasoning-delta"].includes(x.type))).toBe(false);
  });
  it.each([
    '{"blocks":["bad"]}\n',
    '{"end":true,"end":true}\n',
    "winner: Metiendo Mano\n",
    '{"blocks":[],"role":"guest"}\n',
  ])("rejects malformed or interpretive output %s", async value => {
    const { registry } = setup();
    const out = await run([text(value), finish], registry);
    expect(passages(out)).toHaveLength(0);
    expect(status(out)).toBe("failed");
  });
  it.each(["missing-end", "trailing-text", "duplicate-id", "length"])(
    "keeps a valid prefix partial: %s",
    async mode => {
      const { registry, result } = setup();
      const id = result.blocks[0].id;
      const tail =
        mode === "trailing-text"
          ? '{"end":true}\nextra\n'
          : mode === "duplicate-id"
            ? selector(id)
            : "";
      const out = await run(
        [
          text(selector(id)),
          text(tail),
          mode === "length" ? { type: "finish", finishReason: "length" } : finish,
        ],
        registry,
      );
      expect(passages(out)).toHaveLength(1);
      expect(status(out)).toBe("partial");
    },
  );
  it("suppresses arbitrary files, reasoning and tool output payloads", async () => {
    const { registry, result } = setup();
    const out = await run(
      [
        { type: "file", url: "secret-file", mediaType: "x" },
        { type: "reasoning-delta", id: "r", delta: "secret" },
        {
          type: "tool-output-available",
          toolCallId: "x",
          output: { secret: "private" },
        },
        text(selector(result.blocks[0].id) + '{"end":true}\n'),
        finish,
      ],
      registry,
    );
    expect(JSON.stringify(out)).not.toMatch(/secret|private|secret-file/);
  });
  it("survives every selector chunk split without text corruption", async () => {
    const { registry, result, source } = setup();
    const s = selector(result.blocks[0].id) + '{"end":true}\n';
    for (let i = 0; i <= s.length; i++) {
      const out = await run([text(s.slice(0, i)), text(s.slice(i)), finish], registry);
      expect(passages(out)[0].data.text).toBe(source.text);
    }
  });
  it("returns explicitly unavailable for PDF-only selection", async () => {
    const registry = createAttributionRegistry({
      artistId: "artist",
      turnId: "turn",
      assertCurrent: async () => {},
    });
    registry.notePdfUnavailable();
    const out = await run([text('{"end":true}\n'), finish], registry);
    expect(passages(out)).toHaveLength(0);
    expect(status(out)).toBe("unavailable");
  });
  it("does not emit after cancellation while checking current evidence", async () => {
    const controller = new AbortController();
    const { registry, result } = setup(
      {},
      vi.fn(async () => controller.abort()),
    );
    const out = await run(
      [text(selector(result.blocks[0].id)), finish],
      registry,
      controller.signal,
    );
    expect(passages(out)).toHaveLength(0);
    expect(status(out)).toBe("stopped");
  });
});
