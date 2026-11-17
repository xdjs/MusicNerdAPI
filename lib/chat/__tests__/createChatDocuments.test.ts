import { describe, expect, it, vi } from "vitest";
import { createChatCitations } from "../createChatCitations";
import { createChatDocuments, type ChatDocumentRef } from "../createChatDocuments";

const ref = (over: Partial<ChatDocumentRef> = {}): ChatDocumentRef => ({
  sourceKind: "vault",
  sourceId: "a",
  revision: "r1",
  title: "Doc A",
  url: "https://example.com/a",
  ...over,
});

const urlOf = (r: ChatDocumentRef) => r.url ?? `musicnerd://${r.sourceKind}/${r.sourceId}`;

const setup = (prior: { n: number; ref: ChatDocumentRef }[] = []) => {
  const write = vi.fn();
  const cite = createChatCitations(
    { write } as never,
    [...prior]
      .sort((a, b) => a.n - b.n)
      .map(({ n, ref }) => ({ n, url: urlOf(ref), title: ref.title })),
  );
  return { write, docs: createChatDocuments(cite, prior) };
};

describe("createChatDocuments", () => {
  it("cites on first registration and returns 1", () => {
    const { write, docs } = setup();
    expect(docs.register(ref())).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      type: "source-url",
      sourceId: "1",
      url: "https://example.com/a",
      title: "Doc A",
    });
  });

  it("returns the same number for the same document without a new part", () => {
    const { write, docs } = setup();
    docs.register(ref());
    expect(docs.register(ref())).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("uses a synthetic url for null-url documents and dedups them by document", () => {
    const { write, docs } = setup();
    const a = ref({ url: null, sourceKind: "evidence", sourceId: "e1" });
    expect(docs.register(a)).toBe(1);
    expect(docs.register(a)).toBe(1);
    expect(docs.register({ ...a, sourceId: "e2" })).toBe(2);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0].url).toBe("musicnerd://evidence/e1");
  });

  it("gives distinct numbers to different documents sharing a url", () => {
    const { write, docs } = setup();
    docs.register(ref());
    expect(docs.register(ref({ sourceId: "b" }))).toBe(2);
    expect(write.mock.calls[1][0]).toEqual({
      type: "source-url",
      sourceId: "2",
      url: "musicnerd://vault/b",
      title: "Doc A",
    });
    expect(docs.get(1)?.sourceId).toBe("a");
    expect(docs.get(2)?.sourceId).toBe("b");
  });

  it("keeps prior numbering and numbers the next document k+1", () => {
    const prior = [
      { n: 2, ref: ref({ sourceId: "b", url: "https://example.com/b" }) },
      { n: 1, ref: ref() },
    ];
    const { write, docs } = setup(prior);
    expect(docs.get(1)?.sourceId).toBe("a");
    expect(docs.get(2)?.sourceId).toBe("b");
    expect(write.mock.calls.map(c => c[0].sourceId)).toEqual(["1", "2"]);
    expect(docs.register(ref({ sourceId: "c", url: "https://example.com/c" }))).toBe(3);
    expect(docs.register(ref())).toBe(1);
    expect(docs.all().map(d => d.n)).toEqual([1, 2, 3]);
  });

  it("get returns undefined for an unknown number", () => {
    expect(setup().docs.get(9)).toBeUndefined();
  });

  it("keeps a gapped prior numbering and numbers the next document after the highest", () => {
    const c = ref({ sourceId: "c", url: "https://example.com/c" });
    const { write, docs } = setup([
      { n: 1, ref: ref() },
      { n: 3, ref: c },
    ]);
    expect(docs.get(1)?.sourceId).toBe("a");
    expect(docs.get(3)?.sourceId).toBe("c");
    expect(docs.get(2)).toBeUndefined();
    expect(write.mock.calls.map(x => x[0].sourceId)).toEqual(["1", "3"]);
    expect(docs.register(ref({ sourceId: "d", url: "https://example.com/d" }))).toBe(4);
  });

  it("throws when cite was not seeded with a gapped prior", () => {
    const cite = createChatCitations({ write: vi.fn() } as never);
    expect(() =>
      createChatDocuments(cite, [
        { n: 1, ref: ref() },
        { n: 3, ref: ref({ sourceId: "c", url: "https://example.com/c" }) },
      ]),
    ).toThrow("prior document n expected 3, cite returned 2");
  });

  it("keeps two prior documents that share a url distinct when cite is seeded with the synthetic url", () => {
    const b = ref({ sourceId: "b" });
    const cite = createChatCitations({ write: vi.fn() } as never, [
      { n: 1, url: "https://example.com/a", title: "Doc A" },
      { n: 2, url: "musicnerd://vault/b", title: "Doc A" },
    ]);
    const docs = createChatDocuments(cite, [
      { n: 1, ref: ref() },
      { n: 2, ref: b },
    ]);
    expect(docs.get(1)?.sourceId).toBe("a");
    expect(docs.get(2)?.sourceId).toBe("b");
    expect(docs.register(ref({ sourceId: "c", url: "https://example.com/c" }))).toBe(3);
  });
});
