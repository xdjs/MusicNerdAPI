import { describe, it, expect, vi, beforeEach } from "vitest";

const { streamText } = vi.hoisted(() => ({ streamText: vi.fn() }));
vi.mock("@/lib/ai/streamText", () => ({ streamText }));
const { generateAboutFromDoc } = await import("@/lib/lore/generateAboutFromDoc");

beforeEach(() => streamText.mockReset().mockResolvedValue({ text: "An About." }));

describe("generateAboutFromDoc", () => {
  it("writes from the document with the About instruction, thinking off, and trims", async () => {
    streamText.mockResolvedValueOnce({ text: "  A concrete About.  " });
    expect(await generateAboutFromDoc("Nova Reyes", "## Overview\ndoc")).toBe("A concrete About.");
    const call = streamText.mock.calls[0][0];
    expect(call).toMatchObject({
      prompt: "ARTIST KNOWLEDGE DOCUMENT:\n## Overview\ndoc",
      temperature: 0.5,
      thinkingBudget: 0,
    });
    expect(call.instructions).toContain('Write the public "About" for "Nova Reyes"');
    expect(call.onTextDelta).toBeUndefined();
  });

  it("strips a marker not present in the sources it was given", async () => {
    streamText.mockResolvedValueOnce({
      text: "They cited Lauryn Hill[1] and something unverifiable[7].",
    });
    const sources = [{ id: 1, kind: "vault" as const, label: "SoundBetter", url: "https://x" }];
    const about = await generateAboutFromDoc("Nova Reyes", "doc", sources);
    expect(about).toContain("Lauryn Hill[1]");
    expect(about).not.toContain("[7]");
  });

  it("hands each delta to onTextDelta", async () => {
    streamText.mockImplementationOnce(async ({ onTextDelta }) => {
      onTextDelta?.("## Overview\n");
      onTextDelta?.("A real doc.");
      return { text: "## Overview\nA real doc." };
    });
    const deltas: string[] = [];
    await generateAboutFromDoc("Nova Reyes", "doc", [], { onTextDelta: d => deltas.push(d) });
    expect(deltas).toEqual(["## Overview\n", "A real doc."]);
  });

  it("caps at MAX_BIO_LENGTH and throws on an empty reply or a timeout", async () => {
    streamText.mockResolvedValueOnce({ text: "x".repeat(12_000) });
    expect(await generateAboutFromDoc("N", "doc")).toHaveLength(10_000);
    streamText.mockResolvedValueOnce({ text: "  " });
    await expect(generateAboutFromDoc("N", "doc")).rejects.toThrow(
      "About generation returned empty text",
    );
    vi.useFakeTimers();
    streamText.mockReturnValueOnce(new Promise(() => {}));
    const settled = expect(generateAboutFromDoc("N", "doc")).rejects.toThrow("Gemini timeout");
    await vi.advanceTimersByTimeAsync(12_000);
    await settled;
    vi.useRealTimers();
  });
});
