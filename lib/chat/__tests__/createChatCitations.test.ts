import { expect, it, vi } from "vitest";
import { createChatCitations } from "@/lib/chat/createChatCitations";

it("numbers sources from 1 in order of first citation and writes one source-url part each", () => {
  const writer = { write: vi.fn(), merge: vi.fn(), onError: undefined };
  const cite = createChatCitations(writer);
  expect(cite({ url: "https://a.example/1", title: "a.example" })).toBe(1);
  expect(cite({ url: "https://b.example/2", title: "B" })).toBe(2);
  expect(cite({ url: "https://a.example/1", title: "a.example" })).toBe(1);
  expect(writer.write.mock.calls).toEqual([
    [{ type: "source-url", sourceId: "1", url: "https://a.example/1", title: "a.example" }],
    [{ type: "source-url", sourceId: "2", url: "https://b.example/2", title: "B" }],
  ]);
});

it("seeds carried numbers, writes their parts, and continues after the highest, leaving gaps", () => {
  const writer = { write: vi.fn(), merge: vi.fn(), onError: undefined };
  const cite = createChatCitations(writer, [
    { n: 1, url: "https://a.example/1", title: "A" },
    { n: 3, url: "https://c.example/3", title: "C" },
    { n: 3, url: "https://c.example/3", title: "C" },
  ]);
  expect(writer.write.mock.calls.map(([p]) => p.sourceId)).toEqual(["1", "3"]);
  expect(cite({ url: "https://c.example/3", title: "C" })).toBe(3);
  expect(cite({ url: "https://d.example/4", title: "D" })).toBe(4);
  expect(writer.write).toHaveBeenCalledTimes(3);
});

it("starts new numbers above a higher number earlier answers cited, never reusing one", () => {
  const writer = { write: vi.fn(), merge: vi.fn(), onError: undefined };
  const cite = createChatCitations(writer, [{ n: 1, url: "https://a.example/1", title: "A" }], 5);
  expect(cite({ url: "https://web.example/", title: "Web" })).toBe(6);
  const low = createChatCitations(
    { write: vi.fn(), merge: vi.fn(), onError: undefined },
    [{ n: 4, url: "https://a.example/1", title: "A" }],
    2,
  );
  expect(low({ url: "https://web.example/", title: "Web" })).toBe(5);
});
