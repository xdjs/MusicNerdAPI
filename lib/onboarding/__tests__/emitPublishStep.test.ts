import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({
  sources: vi.fn(),
  synth: vi.fn(),
  fallback: vi.fn(),
  artist: vi.fn(),
}));
vi.mock("@/lib/lore/buildDocSources", () => ({ buildDocSources: m.sources }));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: m.synth }));
vi.mock("@/lib/lore/synthesizeFallbackAbout", () => ({ synthesizeFallbackAbout: m.fallback }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
const { emitPublishStep } = await import("@/lib/onboarding/emitPublishStep");

const S = [
  { id: 1, kind: "vault", label: "A", url: "https://a" },
  { id: 2, kind: "vault", label: "B", url: "https://b" },
];

beforeEach(() => {
  m.sources.mockReset().mockResolvedValue(S);
  m.synth.mockReset().mockResolvedValue({ doc: "## Overview\nCited[2].", sources: S });
  m.fallback.mockReset().mockResolvedValue("Plain about.");
  m.artist.mockReset().mockResolvedValue({ id: "a1", name: "Nova" });
});

describe("emitPublishStep", () => {
  it("builds the document from one manifest and hands it over at stage doc, citing only what it uses", async () => {
    const events = await collect(emitPublishStep("a1"));
    expect(m.synth).toHaveBeenCalledWith("a1", S);
    expect(events).toEqual([
      { kind: "chat", text: expect.stringMatching(/^Okay, I have everything I need/) },
      { kind: "progress", label: "Reading your sources and answers", done: false },
      { kind: "progress", label: "Reading your sources and answers", done: true },
      { kind: "chat", text: expect.stringMatching(/^Here's your knowledge document\./) },
      { kind: "draft", stage: "doc", doc: "## Overview\nCited[2].", about: null, sources: [S[1]] },
    ]);
  });

  it("retries once, then falls back to the plain About as the document", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.synth.mockRejectedValue(new Error("Gemini timeout"));
    const events = await collect(emitPublishStep("a1"));
    expect(m.synth).toHaveBeenCalledTimes(2);
    expect(events.filter(e => e.kind === "chat").map(e => (e as { text: string }).text)).toContain(
      "Hmm, that didn't come together — give me one more second.",
    );
    expect(m.fallback).toHaveBeenCalledWith("a1", "Nova", undefined, S);
    expect(events.at(-1)).toMatchObject({
      kind: "draft",
      stage: "doc",
      doc: "## Overview\nPlain about.",
    });
    error.mockRestore();
  });

  it("doesn't retry once past the publish retry budget", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(0).mockReturnValue(60_000);
    m.synth.mockRejectedValueOnce(new Error("slow"));
    await expect(collect(emitPublishStep("a1"))).rejects.toThrow("slow");
    now.mockRestore();
  });
});
