import { expect, it, vi } from "vitest";
import type { UIMessageChunk, UIMessageStreamWriter } from "ai";
import { createChatConflictFallback } from "@/lib/chat/createChatConflictFallback";
import { originalFixture } from "./originalFixture";
const options = { toolCallId: "test", messages: [] } as never;
const originals = [
  originalFixture(
    "a",
    "https://a.example",
    "Heading\n\n1975\n\nImage credit\n\nBoth musicians performed.\n\nNot their first collaboration.",
  ),
  originalFixture(
    "b",
    "https://b.example",
    "Title\n\n1977\n\nThe review calls it their first collaboration.",
  ),
];
function setup() {
  let stream: ReadableStream<UIMessageChunk>;
  const writer = {
    write: vi.fn(),
    merge: (s: ReadableStream<UIMessageChunk>) => {
      stream = s;
    },
    onError: undefined,
  } as UIMessageStreamWriter;
  const fallback = createChatConflictFallback(originals, vi.fn().mockReturnValue(1), writer);
  return { fallback, readStream: () => stream! };
}
async function collect(stream: ReadableStream<UIMessageChunk>) {
  const result: UIMessageChunk[] = [];
  const reader = stream.getReader();
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    result.push(next.value);
  }
  return result;
}
const textParts: UIMessageChunk[] = [
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: "Invented guest role." },
  { type: "text-end", id: "t" },
];
it.each(["error", "abort"] as const)("never releases buffered text after %s", async type => {
  const { fallback, readStream } = setup();
  fallback.writer.merge(
    new ReadableStream({
      start(c) {
        for (const p of textParts) c.enqueue(p);
        c.enqueue(type === "error" ? { type, errorText: "failed" } : { type });
        c.close();
      },
    }),
  );
  const chunks = await collect(readStream());
  expect(chunks.some(c => c.type === "text-delta")).toBe(false);
  expect(chunks.some(c => c.type === type)).toBe(true);
});
it("discards intermediate prose and same-step prose when terminal excerpts are selected", async () => {
  const { fallback, readStream } = setup();
  await fallback.readSource.execute!({ sourceId: "a" }, options);
  await fallback.readSource.execute!({ sourceId: "b" }, options);
  fallback.writer.merge(
    new ReadableStream({
      async start(c) {
        for (const p of textParts) c.enqueue(p);
        c.enqueue({
          type: "tool-input-available",
          toolCallId: "read",
          toolName: "readSource",
          input: { sourceId: "a" },
        });
        c.enqueue({ type: "finish-step" });
        for (const p of textParts) c.enqueue(p);
        await fallback.showSourceDifferences.execute!(
          {
            sources: [
              { sourceId: "a", anchor: "Both musicians" },
              { sourceId: "b", anchor: "The review" },
            ],
          },
          options,
        );
        c.enqueue({ type: "finish-step" });
        c.close();
      },
    }),
  );
  const chunks = await collect(readStream());
  const text = chunks
    .filter(c => c.type === "text-delta")
    .map(c => c.delta)
    .join("");
  expect(text).not.toContain("Invented guest role");
  expect(text).toContain("Heading\n\n1975\n\nImage credit");
  expect(text).toContain("Not their first collaboration.");
  expect(fallback.stop()).toBe(true);
});
it("rejects unread sources, ambiguous anchors and duplicate source selection without stopping", async () => {
  const { fallback } = setup();
  const sources = [
    { sourceId: "a", anchor: "Both" },
    { sourceId: "b", anchor: "review" },
  ];
  expect(await fallback.showSourceDifferences.execute!({ sources }, options)).toHaveProperty(
    "error",
  );
  await fallback.readSource.execute!({ sourceId: "a" }, options);
  await fallback.readSource.execute!({ sourceId: "b" }, options);
  expect(
    await fallback.showSourceDifferences.execute!({ sources: [sources[0], sources[0]] }, options),
  ).toHaveProperty("error");
  expect(
    await fallback.showSourceDifferences.execute!(
      { sources: [{ sourceId: "a", anchor: "absent" }, sources[1]] },
      options,
    ),
  ).toHaveProperty("error");
  expect(fallback.stop()).toBe(false);
});
it("preserves ordinary terminal text without selecting a fallback", async () => {
  const { fallback, readStream } = setup();
  fallback.writer.merge(
    new ReadableStream({
      start(c) {
        for (const p of textParts) c.enqueue(p);
        c.enqueue({ type: "finish-step" });
        c.close();
      },
    }),
  );
  expect((await collect(readStream())).filter(c => c.type === "text-delta")).toEqual([
    textParts[1],
  ]);
  expect(fallback.stop()).toBe(false); // No semantic guarantee when the model does not choose the tool.
});

it("discards tool-step prose even when no fallback is ever selected", async () => {
  const { fallback, readStream } = setup();
  fallback.writer.merge(
    new ReadableStream({
      start(controller) {
        for (const part of textParts) controller.enqueue(part);
        controller.enqueue({
          type: "tool-input-available",
          toolCallId: "read",
          toolName: "readSource",
          input: { sourceId: "a" },
        });
        controller.enqueue({ type: "finish-step" });
        controller.enqueue({ type: "text-start", id: "final" });
        controller.enqueue({
          type: "text-delta",
          id: "final",
          delta: "Supported final answer [1].",
        });
        controller.enqueue({ type: "text-end", id: "final" });
        controller.enqueue({ type: "finish-step" });
        controller.close();
      },
    }),
  );
  const text = (await collect(readStream()))
    .filter(c => c.type === "text-delta")
    .map(c => c.delta)
    .join("");
  expect(text).toBe("Supported final answer [1].");
  expect(fallback.stop()).toBe(false);
});
