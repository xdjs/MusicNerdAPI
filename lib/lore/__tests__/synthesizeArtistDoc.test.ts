import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  buildDocContext: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));
vi.mock("@/lib/lore/buildDocContext", () => ({ buildDocContext: m.buildDocContext }));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generateText }));
vi.mock("@/lib/ai/streamText", () => ({ streamText: m.streamText }));
const { synthesizeArtistDoc } = await import("@/lib/lore/synthesizeArtistDoc");

const sources = [
  { id: 1, kind: "vault", label: "Pitchfork review", url: "https://pitchfork.com/x" },
  { id: 2, kind: "interview", label: "Their own words", url: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.buildDocContext.mockResolvedValue({ artistName: "Nova Reyes", context: "MATERIAL", sources });
});

describe("synthesizeArtistDoc", () => {
  it("sends the material with the document instruction, thinking off", async () => {
    m.generateText.mockResolvedValueOnce({ text: "## Overview\nA real doc." });
    const { doc, sources: used } = await synthesizeArtistDoc("a1");
    expect(doc).toBe("## Overview\nA real doc.");
    expect(used).toBe(sources);
    const call = m.generateText.mock.calls[0][0];
    expect(call).toMatchObject({ prompt: "MATERIAL", temperature: 0.4, thinkingBudget: 0 });
    expect(call.instructions).toContain('the music artist "Nova Reyes"');
    expect(call.instructions).toContain(`today is ${new Date().toISOString().slice(0, 10)}`);
  });

  it("strips a marker that does not resolve and keeps valid ones", async () => {
    m.generateText.mockResolvedValueOnce({
      text: "Cited Lauryn Hill[1]. Also claims something[99].",
    });
    const { doc } = await synthesizeArtistDoc("a1");
    expect(doc).toContain("Hill[1]");
    expect(doc).not.toContain("[99]");
  });

  it("hard-truncates at 20,000 characters", async () => {
    m.generateText.mockResolvedValueOnce({ text: "x".repeat(30_000) });
    expect((await synthesizeArtistDoc("a1")).doc).toHaveLength(20_000);
  });

  it("throws on an empty reply and on a timeout", async () => {
    m.generateText.mockResolvedValueOnce({ text: "  " });
    await expect(synthesizeArtistDoc("a1")).rejects.toThrow("Doc synthesis returned empty text");
    vi.useFakeTimers();
    m.generateText.mockReturnValueOnce(new Promise(() => {}));
    const pending = synthesizeArtistDoc("a1");
    const settled = expect(pending).rejects.toThrow("Gemini timeout");
    await vi.advanceTimersByTimeAsync(15_000);
    await settled;
    vi.useRealTimers();
  });

  it("builds from the caller's numbered sources when given, without streaming", async () => {
    m.generateText.mockResolvedValueOnce({ text: "## Overview\nA doc." });
    await synthesizeArtistDoc("a1", sources as never);
    expect(m.buildDocContext).toHaveBeenCalledWith("a1", sources);
    expect(m.streamText).not.toHaveBeenCalled();
  });

  it("streams through streamText when the caller wants each delta, with the same settings", async () => {
    m.streamText.mockImplementationOnce(async ({ onTextDelta }) => {
      onTextDelta?.("## Overview\n");
      onTextDelta?.("A real doc.");
      return { text: "## Overview\nA real doc." };
    });
    const deltas: string[] = [];
    const { doc } = await synthesizeArtistDoc("a1", undefined, {
      onTextDelta: d => deltas.push(d),
    });
    expect(doc).toBe("## Overview\nA real doc.");
    expect(deltas).toEqual(["## Overview\n", "A real doc."]);
    expect(m.generateText).not.toHaveBeenCalled();
    expect(m.streamText.mock.calls[0][0]).toMatchObject({
      prompt: "MATERIAL",
      temperature: 0.4,
      thinkingBudget: 0,
    });
  });
});
