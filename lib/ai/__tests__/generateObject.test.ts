import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

const generateText = vi.fn();
vi.mock("@/lib/ai/generateText", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
const { generateObject } = await import("@/lib/ai/generateObject");

describe("generateObject", () => {
  it("asks generateText for an object output built from the schema", async () => {
    generateText.mockResolvedValueOnce({ output: { a: 1 } });
    const result = await generateObject({ prompt: "p", schema: z.object({ a: z.number() }) });
    expect(result.output).toEqual({ a: 1 });
    const call = generateText.mock.calls[0][0];
    expect(call.prompt).toBe("p");
    expect(call.output).toBeDefined();
    expect(call.schema).toBeUndefined();
  });
});
