import assert from "node:assert/strict";
import { streamText, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
const observations: Promise<void>[] = [];
const kinds: string[] = [];
(globalThis as unknown as { pdf106Observe: unknown }).pdf106Observe = (result: {
  fullStream: AsyncIterable<{ type: string }>;
}) => {
  observations.push(
    (async () => {
      for await (const part of result.fullStream) kinds.push(part.type);
    })(),
  );
};
const result = streamText({
  model: new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "offline observer check" },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    },
  }),
  prompt: "No network or paid model",
});
let text = "";
for await (const part of result.fullStream) if (part.type === "text-delta") text += part.text;
await Promise.all(observations);
assert.equal(text, "offline observer check");
assert.ok(kinds.includes("finish-step"));
assert.ok(kinds.includes("finish"));
console.log("Offline bundled SDK observer preserved output and saw usage-bearing finish events.");
