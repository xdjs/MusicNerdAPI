import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({
  emitStep: vi.fn(),
  artist: vi.fn(),
  about: vi.fn(),
  fallback: vi.fn(),
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: m.about }));
vi.mock("@/lib/lore/synthesizeFallbackAbout", () => ({ synthesizeFallbackAbout: m.fallback }));
const { handleAboutChoiceTurn } = await import("@/lib/onboarding/handleAboutChoiceTurn");

const S = [
  { id: 1, kind: "vault", label: "A", url: "https://a" },
  { id: 2, kind: "vault", label: "B", url: "https://b" },
  { id: 3, kind: "vault", label: "C", url: "https://c" },
];

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.artist.mockReset().mockResolvedValue({ id: "a1", name: "Nova", bio: "Bio now" });
  m.about.mockReset().mockResolvedValue("About[2].");
  m.fallback.mockReset().mockResolvedValue("Plain.");
});

describe("handleAboutChoiceTurn", () => {
  it("writes the About from the approved document, citing what either text uses", async () => {
    const events = await collect(
      handleAboutChoiceTurn(turnContext("publish"), {
        type: "about_choice",
        mode: "generate",
        doc: " Doc[1]. ",
        sources: S as never,
      }),
    );
    expect(m.about).toHaveBeenCalledWith("Nova", "Doc[1].", S);
    expect(events).toEqual([
      { kind: "chat", text: "Writing your About from the document." },
      { kind: "progress", label: "Writing your About", done: false },
      { kind: "progress", label: "Writing your About", done: true },
      {
        kind: "chat",
        text: "Your About is ready. Publish it as-is, or edit it first — your call.",
      },
      {
        kind: "draft",
        stage: "about",
        doc: "Doc[1].",
        about: "About[2].",
        sources: [S[0], S[1]],
        expectedBio: "Bio now",
      },
    ]);
  });

  it("opens an empty About for the artist to write, with the starting bio", async () => {
    const events = await collect(
      handleAboutChoiceTurn(turnContext("publish"), {
        type: "about_choice",
        mode: "self",
        doc: "Doc.",
      }),
    );
    expect(events.at(-1)).toEqual({
      kind: "draft",
      stage: "about",
      doc: "Doc.",
      about: "",
      sources: [],
      selfWrite: true,
      expectedBio: "Bio now",
    });
    expect(m.about).not.toHaveBeenCalled();
  });

  it("retries once, then falls back to the plain About", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.about.mockRejectedValue(new Error("Gemini timeout"));
    const events = await collect(
      handleAboutChoiceTurn(turnContext("publish"), {
        type: "about_choice",
        mode: "generate",
        doc: "Doc.",
      }),
    );
    expect(m.about).toHaveBeenCalledTimes(2);
    expect(m.fallback).toHaveBeenCalledWith("a1", "Nova", "Doc.", []);
    expect(events.at(-1)).toMatchObject({ kind: "draft", about: "Plain." });
    error.mockRestore();
  });

  it("regenerates when the echoed document is missing or too long", async () => {
    const events = await collect(
      handleAboutChoiceTurn(turnContext("publish"), {
        type: "about_choice",
        mode: "generate",
        doc: "x".repeat(20_001),
      }),
    );
    expect(events[0]).toEqual({
      kind: "error",
      message: "That doc looks off — let me regenerate it.",
    });
    expect(m.emitStep).toHaveBeenCalledWith("a1", "publish");
  });
});
