import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({
  artist: vi.fn(),
  sources: vi.fn(),
  synth: vi.fn(),
  about: vi.fn(),
  persist: vi.fn(),
  preserve: vi.fn(),
  pinned: vi.fn(),
  doc: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/lore/buildDocSources", () => ({ buildDocSources: m.sources }));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: m.synth }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: m.about }));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: m.persist }));
vi.mock("@/lib/onboarding/validateSetupLore", () => ({ validateSetupLore: m.validate }));
vi.mock("@/lib/onboarding/persistSetupLore", () => ({ persistSetupLore: m.preserve }));
vi.mock("@/lib/bio/hasPinnedBio", () => ({ hasPinnedBio: m.pinned }));
vi.mock("@/lib/lore/getArtistDocStrict", () => ({ getArtistDocStrict: m.doc }));
const { autoBuildAbout } = await import("@/lib/onboarding/autoBuildAbout");
const { BioConflictError } = await import("@/lib/bio/BioConflictError");

const ownership = { userId: "u1", expectedClaimId: "c1" };
const S = [{ id: 1, kind: "vault" as const, label: "A", url: "https://a" }];

beforeEach(() => {
  m.artist.mockReset().mockResolvedValue({ id: "a1", name: "Nova", bio: null });
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
  m.validate.mockReset().mockResolvedValue(S);
  m.preserve.mockReset().mockResolvedValue(undefined);
  m.pinned.mockReset().mockResolvedValue(false);
  m.doc.mockReset().mockResolvedValue(undefined);
  m.persist.mockReset().mockResolvedValue("About.");
});

describe("autoBuildAbout", () => {
  it("streams both drafts, publishes the clean About with the document, and completes", async () => {
    const events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(events).toEqual([
      {
        kind: "progress",
        label: "Preparing your Lore and About",
        done: false,
        group: "about-write",
      },
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
      expectedBio: null,
      expectedDocument: null,
      document: { content: "## Overview", sources: S },
      documentOrigin: "server",
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
    m.preserve.mockRejectedValueOnce(new BioConflictError());
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

it.each([false, true])(
  "prepares Lore and completes without replacing existing About (pinned=%s)",
  async pinned => {
    m.artist.mockResolvedValue({ id: "a1", name: "Nova", bio: "Artist-written About" });
    m.pinned.mockResolvedValue(pinned);
    const events = await collect(autoBuildAbout("a1", ownership, 1));
    expect(m.about).not.toHaveBeenCalled();
    expect(m.persist).not.toHaveBeenCalled();
    expect(m.preserve).toHaveBeenCalledWith(
      "a1",
      ownership,
      { content: "## Overview", sources: S },
      null,
    );
    expect(events.at(-1)).toEqual({ kind: "complete" });
  },
);
it("preserves a concurrent edit or pin instead of leaving setup incomplete", async () => {
  m.persist.mockRejectedValueOnce(new BioConflictError());
  const events = await collect(autoBuildAbout("a1", ownership, 1));
  expect(m.preserve).toHaveBeenCalledTimes(1);
  expect(events.at(-1)).toEqual({ kind: "complete" });
});

it("retains baseline edited Lore and About without synthesizing either", async () => {
  const doc = { content: "Artist-edited Lore", sources: [], updatedAt: "2026-01-01" };
  m.artist.mockResolvedValue({ id: "a1", name: "Nova", bio: "Existing bio" });
  m.doc.mockResolvedValue(doc);
  const events = await collect(autoBuildAbout("a1", ownership, 1));
  expect(m.synth).not.toHaveBeenCalled();
  expect(m.about).not.toHaveBeenCalled();
  expect(m.preserve).toHaveBeenCalledWith("a1", ownership, null, doc);
  expect(events.at(-1)).toEqual({ kind: "complete" });
});

it("fills empty About from eligible existing Lore without replacing it", async () => {
  const doc = { content: "Edited saved Lore", sources: S, updatedAt: "2026-01-01" };
  m.doc.mockResolvedValue(doc);
  const events = await collect(autoBuildAbout("a1", ownership, 1));
  expect(m.synth).not.toHaveBeenCalled();
  expect(m.sources).not.toHaveBeenCalled();
  expect(m.validate).toHaveBeenCalledWith("a1", ownership, doc);
  expect(m.about).toHaveBeenCalledWith("Nova", doc.content, S, expect.anything());
  const options = m.persist.mock.calls[0][2];
  expect(options.document).toBeUndefined();
  expect(options.expectedLore).toEqual({ content: doc.content, sources: S });
  expect(options.expectedDocument).toEqual(doc);
  expect(events.at(-1)).toEqual({ kind: "complete" });
});
it("keeps stale existing Lore and leaves setup retryable with a review instruction", async () => {
  const { LoreChangedError } = await import("@/lib/lore/LoreChangedError");
  m.doc.mockResolvedValue({ content: "Edited saved Lore", sources: [], updatedAt: null });
  m.validate.mockRejectedValue(new LoreChangedError());
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const events = await collect(autoBuildAbout("a1", ownership, 1));
  expect(m.synth).not.toHaveBeenCalled();
  expect(m.about).not.toHaveBeenCalled();
  expect(m.persist).not.toHaveBeenCalled();
  expect(m.preserve).not.toHaveBeenCalled();
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: expect.stringContaining("review or an explicit refresh"),
  });
  error.mockRestore();
});

it("requires eligible material before generating a missing Lore and About", async () => {
  m.sources.mockResolvedValue([]);
  const events = await collect(autoBuildAbout("a1", ownership, 0));
  expect(m.synth).not.toHaveBeenCalled();
  expect(m.about).not.toHaveBeenCalled();
  expect(m.persist).not.toHaveBeenCalled();
  expect(m.preserve).not.toHaveBeenCalled();
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: expect.stringContaining("approved, readable"),
  });
  expect(events.some(e => e.kind === "complete")).toBe(false);
});
it("can prepare missing Lore without evidence while retaining an existing About", async () => {
  m.sources.mockResolvedValue([]);
  m.artist.mockResolvedValue({ id: "a1", name: "Nova", bio: "Existing human About" });
  const events = await collect(autoBuildAbout("a1", ownership, 0));
  expect(m.synth).toHaveBeenCalled();
  expect(m.about).not.toHaveBeenCalled();
  expect(m.persist).not.toHaveBeenCalled();
  expect(m.preserve).toHaveBeenCalled();
  expect(events.at(-1)).toEqual({ kind: "complete" });
});
