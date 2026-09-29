import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ getApprovedVaultSources: vi.fn(), generateText: vi.fn() }));
vi.mock("@/lib/lore/getApprovedVaultSources", () => ({
  getApprovedVaultSources: m.getApprovedVaultSources,
}));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generateText }));
const { generateLoreSummary } = await import("@/lib/lore/generateLoreSummary");
const { loreSourceKey } = await import("@/lib/lore/loreSourceKey");

const sources = [
  {
    id: "d",
    title: "Studio journal",
    type: "document",
    extractedText: "private raw payload",
    url: "https://example.com/doc",
  },
  { id: "a", title: "Conversation", type: "audio" },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.getApprovedVaultSources.mockResolvedValue(sources);
});

describe("generateLoreSummary", () => {
  it("summarises titles and media types only, never text or URLs", async () => {
    m.generateText.mockResolvedValueOnce({ text: " A journal and a conversation. " });
    expect(await generateLoreSummary("a1")).toEqual({
      text: "A journal and a conversation.",
      sourceKey: loreSourceKey(sources),
    });
    const call = m.generateText.mock.calls[0][0];
    expect(call.prompt).toBe(
      JSON.stringify([
        { title: "Studio journal", type: "document" },
        { title: "Conversation", type: "audio" },
      ]),
    );
    expect(call.prompt).not.toContain("private raw payload");
    expect(call.prompt).not.toContain("https://");
    expect(call.instructions).toContain("Lore source collection");
    expect(call).toMatchObject({ temperature: 0.2, thinkingBudget: 0 });
  });

  it("is null for an empty source set, without a model call", async () => {
    m.getApprovedVaultSources.mockResolvedValueOnce([]);
    expect(await generateLoreSummary("a1")).toBeNull();
    expect(m.generateText).not.toHaveBeenCalled();
  });

  it("is undefined (keep the last good one) for an oversized, empty or failed summary", async () => {
    m.generateText.mockResolvedValueOnce({ text: "x".repeat(901) });
    expect(await generateLoreSummary("a1")).toBeUndefined();
    m.generateText.mockResolvedValueOnce({ text: "" });
    expect(await generateLoreSummary("a1")).toBeUndefined();
    m.generateText.mockImplementationOnce(async () => {
      throw new Error("provider unavailable");
    });
    expect(await generateLoreSummary("a1")).toBeUndefined();
  });
});
