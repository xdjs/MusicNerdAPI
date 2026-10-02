import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({
  artist: vi.fn(),
  sources: vi.fn(),
  synth: vi.fn(),
  about: vi.fn(),
  persist: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/lore/buildDocSources", () => ({ buildDocSources: m.sources }));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: m.synth }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: m.about }));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: m.persist }));
const { autoBuildAbout } = await import("@/lib/onboarding/autoBuildAbout");
const { BioConflictError } = await import("@/lib/bio/BioConflictError");

const ownership = { userId: "u1", expectedClaimId: "c1" };
const S = [{ id: 1, kind: "vault" as const, label: "A", url: "https://a" }];

beforeEach(() => {
  m.artist.mockReset().mockResolvedValue({ id: "a1", name: "Nova", bio: "Old bio" });
  m.sources.mockReset().mockResolvedValue(S);
  m.synth
    .mockReset()
    .mockImplementation(
      async (_a: string, _s: unknown, { onTextDelta }: { onTextDelta: (d: string) => void }) => {
        onTextDelta("## Over");
        onTextDelta("view");
        return { doc: "## Overview", sources: S };
      },
    );
  m.about
    .mockReset()
    .mockImplementation(
      async (
        _n: string,
        _d: string,
        _s: unknown,
        { onTextDelta }: { onTextDelta: (d: string) => void },
      ) => {
        onTextDelta("About[1].");
        return "About[1].";
      },
    );
  m.persist.mockReset().mockResolvedValue("About.");
});

describe("autoBuildAbout", () => {
  it("streams both drafts, publishes the clean About with the document, and completes", async () => {
    const events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(events).toEqual([
      { kind: "progress", label: "Writing your About", done: false, group: "about-write" },
      { kind: "text-delta", group: "about-write", call: "doc", delta: "## Over" },
      { kind: "text-delta", group: "about-write", call: "doc", delta: "view" },
      { kind: "text-delta", group: "about-write", call: "about", delta: "About[1]." },
      { kind: "progress", label: "Wrote your About", done: true, group: "about-write" },
      {
        kind: "chat",
        text: expect.stringMatching(/^Done\. Your page is live below\. You can edit/),
      },
      { kind: "complete" },
    ]);
    expect(m.synth).toHaveBeenCalledWith("a1", S, { onTextDelta: expect.any(Function) });
    expect(m.about).toHaveBeenCalledWith("Nova", "## Overview", S, {
      onTextDelta: expect.any(Function),
    });
    expect(m.persist).toHaveBeenCalledWith("a1", "About.", {
      generated: true,
      ownership,
      expectedBio: "Old bio",
      document: { content: "## Overview", sources: S },
      confirmSteps: ["interview", "publish"],
    });
  });

  it("uses the thin line when nothing citable was found", async () => {
    const events = await collect(autoBuildAbout("a1", ownership, 0));
    expect(events.find(e => e.kind === "chat")).toEqual({
      kind: "chat",
      text: expect.stringMatching(/^Done, though I didn't find much/),
    });
  });

  it("reports a failure, a bio conflict and an empty About as errors, never completing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.synth.mockRejectedValueOnce(new Error("Gemini timeout"));
    let events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(events.at(-1)).toEqual({
      kind: "error",
      message: "Could not publish your About and Lore. Please try again; your saved bio is safe.",
    });
    m.persist.mockRejectedValueOnce(new BioConflictError());
    events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(events.at(-1)).toEqual({ kind: "error", message: new BioConflictError().message });
    m.about.mockResolvedValueOnce("   ");
    events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(events.slice(-2)).toEqual([
      { kind: "progress", label: "Couldn't write an About yet", done: true, group: "about-write" },
      { kind: "error", message: "No About was produced. Please try again." },
    ]);
    expect(events.some(e => e.kind === "complete")).toBe(false);
    error.mockRestore();
  });
});
