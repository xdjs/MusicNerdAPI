import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import { gateStepText } from "@/lib/chat/gateStepText";

const run = async (chunks: UIMessageChunk[]) => {
  const out: UIMessageChunk[] = [];
  const reader = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  })
    .pipeThrough(gateStepText())
    .getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
};
const text = (id: string, ...deltas: string[]): UIMessageChunk[] => [
  { type: "text-start", id },
  ...deltas.map(delta => ({ type: "text-delta" as const, id, delta })),
  { type: "text-end", id },
];

describe("gateStepText", () => {
  it("drops narration written in a step that goes on to call a tool", async () => {
    const out = await run([
      { type: "start", messageId: "m" },
      { type: "start-step" },
      ...text("t1", "Let me read ", "the key sources."),
      { type: "tool-input-start", toolCallId: "c", toolName: "readSource" },
      { type: "tool-input-available", toolCallId: "c", toolName: "readSource", input: {} },
      { type: "finish-step" },
      { type: "tool-output-available", toolCallId: "c", output: { n: 1 } },
      { type: "start-step" },
      ...text("t2", "Born in ", "Richmond [1]."),
      { type: "finish-step" },
      { type: "finish" },
    ]);
    expect(
      out.filter(c => c.type === "text-delta").map(c => (c as { delta: string }).delta),
    ).toEqual(["Born in ", "Richmond [1]."]);
    expect(out.map(c => c.type)).toEqual([
      "start",
      "start-step",
      "tool-input-start",
      "tool-input-available",
      "finish-step",
      "tool-output-available",
      "start-step",
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "finish-step",
      "finish",
    ]);
  });

  it("streams the final answer after a short hold, and flushes held text when the step ends without a tool", async () => {
    const long = "x".repeat(300);
    const out = await run([
      { type: "start-step" },
      ...text("t", "short ", long, " tail"),
      { type: "finish-step" },
    ]);
    expect(out.map(c => c.type)).toEqual([
      "start-step",
      "text-start",
      "text-delta",
      "text-delta",
      "text-delta",
      "text-end",
      "finish-step",
    ]);
    const held = await run([
      { type: "start-step" },
      ...text("t", "A sentence."),
      { type: "finish-step" },
    ]);
    expect(held.map(c => c.type)).toEqual([
      "start-step",
      "text-start",
      "text-delta",
      "text-end",
      "finish-step",
    ]);
  });

  it("lets text through once it exceeds the hold, even if a tool follows, and passes errors unchanged", async () => {
    const long = "y".repeat(300);
    const out = await run([
      { type: "start-step" },
      ...text("t", long),
      { type: "tool-input-start", toolCallId: "c", toolName: "readSource" },
      { type: "finish-step" },
      { type: "error", errorText: "boom" },
    ]);
    expect(out.map(c => c.type)).toEqual([
      "start-step",
      "text-start",
      "text-delta",
      "text-end",
      "tool-input-start",
      "finish-step",
      "error",
    ]);
  });
});
