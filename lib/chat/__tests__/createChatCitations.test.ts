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
