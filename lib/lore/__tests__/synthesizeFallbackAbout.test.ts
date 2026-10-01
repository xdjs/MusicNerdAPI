import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ generateText: vi.fn(), buildDocContext: vi.fn() }));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generateText }));
vi.mock("@/lib/lore/buildDocContext", () => ({ buildDocContext: m.buildDocContext }));
const { synthesizeFallbackAbout } = await import("@/lib/lore/synthesizeFallbackAbout");

const preset = [{ id: 1, kind: "vault" as const, label: "L", url: "u" }];

beforeEach(() => {
  m.generateText.mockReset().mockResolvedValue({ text: "An About." });
  m.buildDocContext.mockReset().mockResolvedValue({ artistName: "N", context: "RAW", sources: [] });
});

describe("synthesizeFallbackAbout", () => {
  it("writes from the finished document when there is one, without re-reading", async () => {
    expect(await synthesizeFallbackAbout("a1", "Nova Reyes", "## Overview\ndoc")).toBe("An About.");
    expect(m.buildDocContext).not.toHaveBeenCalled();
    const call = m.generateText.mock.calls[0][0];
    expect(call).toMatchObject({
      prompt: "ARTIST MATERIAL:\n## Overview\ndoc",
      temperature: 0.5,
      thinkingBudget: 0,
    });
    expect(call.instructions).toContain('the music artist "Nova Reyes"');
  });

  it("rebuilds the raw material, with the preset manifest, when the document failed", async () => {
    await synthesizeFallbackAbout("a1", "Nova Reyes", undefined, preset);
    expect(m.buildDocContext).toHaveBeenCalledWith("a1", preset);
    expect(m.generateText.mock.calls[0][0].prompt).toBe("ARTIST MATERIAL:\nRAW");
  });

  it("strips every marker and caps the length", async () => {
    m.generateText.mockResolvedValueOnce({
      text: "Echoed a cited doc [3, 4]. " + "x".repeat(12_000),
    });
    const about = await synthesizeFallbackAbout("a1", "N", "doc");
    expect(about).not.toMatch(/\[\d/);
    expect(about).toHaveLength(10_000);
  });

  it("throws on an empty reply or a timeout", async () => {
    m.generateText.mockResolvedValueOnce({ text: " " });
    await expect(synthesizeFallbackAbout("a1", "N", "doc")).rejects.toThrow(
      "Fallback About generation returned empty text",
    );
    vi.useFakeTimers();
    m.generateText.mockReturnValueOnce(new Promise(() => {}));
    const settled = expect(synthesizeFallbackAbout("a1", "N", "doc")).rejects.toThrow(
      "Gemini timeout",
    );
    await vi.advanceTimersByTimeAsync(12_000);
    await settled;
    vi.useRealTimers();
  });
});
