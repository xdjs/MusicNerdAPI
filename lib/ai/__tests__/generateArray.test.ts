import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

const generateText = vi.fn();
vi.mock("@/lib/ai/generateText", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
const { generateArray } = await import("@/lib/ai/generateArray");

describe("generateArray", () => {
  it("asks generateText for an array output built from the element schema", async () => {
    generateText.mockResolvedValueOnce({ output: [{ i: 0 }] });
    const result = await generateArray({ prompt: "p", element: z.object({ i: z.number() }) });
    expect(result.output).toEqual([{ i: 0 }]);
    const call = generateText.mock.calls[0][0];
    expect(call.prompt).toBe("p");
    expect(call.output).toBeDefined();
    expect(call.element).toBeUndefined();
  });
});
