import { afterEach, expect, it, vi } from "vitest";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { originalFixture } from "./originalFixture";

const call = { toolCallId: "c", messages: [] } as never;
afterEach(() => vi.restoreAllMocks());

it("returns the stored text with its citation number, without fetching the page", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const cite = vi.fn().mockReturnValue(3);
  const readSource = createReadSourceTool(
    [originalFixture("vault:1", "https://www.news.example/a", "Stored text.")],
    cite,
  );
  const result = await readSource.execute!({ sourceId: "vault:1" }, call);
  expect(result).toEqual({
    n: 3,
    title: "news.example",
    url: "https://www.news.example/a",
    text: "Stored text.",
    publishedAt: null,
    activityDate: null,
    retrievedAt: null,
  });
  expect(cite).toHaveBeenCalledWith({ url: "https://www.news.example/a", title: "news.example" });
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("caps the text at 12,000 characters", async () => {
  const readSource = createReadSourceTool(
    [originalFixture("vault:1", "https://a.example/", "x".repeat(20000))],
    () => 1,
  );
  const result = await readSource.execute!({ sourceId: "vault:1" }, call);
  expect((result as { text: string }).text).toHaveLength(12000);
});

it("cites nothing for an unknown source", async () => {
  const cite = vi.fn();
  const readSource = createReadSourceTool([], cite);
  expect(await readSource.execute!({ sourceId: "vault:9" }, call)).toEqual({
    error: "Unknown sourceId. Use an id from searchSources.",
  });
  expect(cite).not.toHaveBeenCalled();
});

it("transports a late ranked window into an exact bounded read with heading and qualification", async () => {
  const { createSearchSourcesTool } = await import("../createSearchSourcesTool");
  const text =
    "Unrelated preface. ".repeat(1000) +
    "SECTION HEADING\nDub sessions were provisional, not released.\n" +
    "Additional context. ".repeat(800);
  const source = originalFixture("vault:late", "https://example.com/late", text);
  const search = createSearchSourcesTool([source], "Artist");
  const discovered = (await search.execute!({ query: "dub" }, call)) as {
    sources: {
      snippet: string;
      locator: { sourceId: string; revision: string; start: number; end: number };
    }[];
  };
  const { locator, snippet } = discovered.sources[0];
  expect(locator.start).toBeGreaterThan(12000);
  expect(snippet).toContain("Dub sessions");
  expect(snippet.length).toBeLessThanOrEqual(300);
  const result = (await createReadSourceTool([source], () => 2).execute!(
    { sourceId: source.sourceId, locator },
    call,
  )) as { text: string; start: number; end: number; revision: string; truncated: boolean };
  expect(result.text).toBe(text.slice(result.start, result.end));
  expect(result.start).toBeLessThanOrEqual(locator.start);
  expect(result.end).toBeGreaterThanOrEqual(locator.end);
  expect(result.text.length).toBeLessThanOrEqual(12000);
  expect(result.text).toContain("SECTION HEADING\nDub sessions were provisional, not released.");
  expect(result.revision).toBe(source.revision);
  expect(result.truncated).toBe(true);
});

it("rejects malformed, stale, foreign and out-of-bounds locators without citing or falling back", async () => {
  const source = originalFixture("one", "https://example.com/one", "x".repeat(20000));
  const cite = vi.fn();
  const read = createReadSourceTool([source], cite);
  const valid = { sourceId: source.sourceId, revision: source.revision, start: 13000, end: 14000 };
  for (const locator of [
    null,
    {},
    { ...valid, revision: "stale" },
    { ...valid, sourceId: "other" },
    { ...valid, start: -1 },
    { ...valid, start: 1.5 },
    { ...valid, start: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, start: valid.end },
    { ...valid, end: 20001 },
    { ...valid, start: 0, end: 12001 },
  ]) {
    const result = await read.execute!({ sourceId: source.sourceId, locator } as never, call);
    expect(result).toHaveProperty("error");
    expect(result).not.toHaveProperty("text");
  }
  expect(await read.execute!({ sourceId: "unknown", locator: valid }, call)).toHaveProperty(
    "error",
  );
  expect(cite).not.toHaveBeenCalled();
});

it("keeps two search locators independent and source-only prefix reads unchanged", async () => {
  const { createSearchSourcesTool } = await import("../createSearchSourcesTool");
  const text =
    "Preface. ".repeat(1700) +
    "Dub session detail." +
    " Middle. ".repeat(1700) +
    "Violin concert detail.";
  const source = originalFixture("one", "https://example.com/one", text);
  const search = createSearchSourcesTool([source], "Artist");
  type Located = {
    sources: { locator: { sourceId: string; revision: string; start: number; end: number } }[];
  };
  const first = (await search.execute!({ query: "dub" }, call)) as Located;
  const second = (await search.execute!({ query: "violin" }, call)) as Located;
  expect(first.sources[0].locator.start).not.toBe(second.sources[0].locator.start);
  const read = createReadSourceTool([source], () => 1);
  const afterSecondSearch = (await read.execute!(
    { sourceId: source.sourceId, locator: first.sources[0].locator },
    call,
  )) as { text: string };
  expect(afterSecondSearch.text).toContain("Dub session detail.");
  const legacy = (await read.execute!({ sourceId: source.sourceId }, call)) as { text: string };
  expect(legacy.text).toBe(text.slice(0, 12000));
  expect(legacy).not.toHaveProperty("start");
});

it("preserves UTF-16 boundaries and the full matched window at the read ceiling", async () => {
  const text = "😀".repeat(15000);
  const source = originalFixture("one", "https://example.com", text);
  const read = createReadSourceTool([source], () => 1);
  const locator = {
    sourceId: source.sourceId,
    revision: source.revision,
    start: 13000,
    end: 25000,
  };
  const result = (await read.execute!({ sourceId: source.sourceId, locator }, call)) as {
    text: string;
    start: number;
    end: number;
  };
  expect(result.text).toBe(text.slice(13000, 25000));
  expect(result.text.length).toBe(12000);
  expect(
    await read.execute!({ sourceId: source.sourceId, locator: { ...locator, start: 13001 } }, call),
  ).toHaveProperty("error");
});
