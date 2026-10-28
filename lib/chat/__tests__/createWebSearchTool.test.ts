import { beforeEach, expect, it, vi } from "vitest";

const { webSearch } = vi.hoisted(() => ({ webSearch: vi.fn() }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
const { createWebSearchTool } = await import("@/lib/chat/createWebSearchTool");

const call = { toolCallId: "c", messages: [] } as never;
beforeEach(() => webSearch.mockReset());

it("searches through the shared web search and numbers each result as a citable source", async () => {
  webSearch.mockResolvedValue([
    { url: "https://a.example/", title: "A", snippet: "first" },
    { url: "https://b.example/", title: "B", snippet: "second" },
  ]);
  const cite = vi.fn().mockReturnValueOnce(2).mockReturnValueOnce(3);
  const result = await createWebSearchTool(cite).execute!({ query: "Dutchyyy label" }, call);
  expect(webSearch).toHaveBeenCalledWith("Dutchyyy label");
  expect(cite.mock.calls).toEqual([
    [{ url: "https://a.example/", title: "A" }],
    [{ url: "https://b.example/", title: "B" }],
  ]);
  expect(result).toEqual({
    results: [
      { n: 2, title: "A", url: "https://a.example/", snippet: "first" },
      { n: 3, title: "B", url: "https://b.example/", snippet: "second" },
    ],
  });
});

it("returns no results when the search finds nothing", async () => {
  webSearch.mockResolvedValue([]);
  expect(await createWebSearchTool(vi.fn()).execute!({ query: "q" }, call)).toEqual({
    results: [],
  });
});
