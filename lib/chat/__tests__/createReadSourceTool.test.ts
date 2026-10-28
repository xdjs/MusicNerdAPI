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
