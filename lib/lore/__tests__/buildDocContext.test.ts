import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocMaterial } from "@/lib/lore/types";

const m = vi.hoisted(() => ({
  gatherDocMaterial: vi.fn(),
  catalogBlock: vi.fn(),
  getDocCorrections: vi.fn(),
}));
vi.mock("@/lib/lore/gatherDocMaterial", () => ({ gatherDocMaterial: m.gatherDocMaterial }));
vi.mock("@/lib/lore/catalogBlock", () => ({ catalogBlock: m.catalogBlock }));
vi.mock("@/lib/lore/getDocCorrections", () => ({ getDocCorrections: m.getDocCorrections }));
const { buildDocContext } = await import("@/lib/lore/buildDocContext");

const material = (over: Partial<DocMaterial> = {}) =>
  ({
    artist: {
      id: "a1",
      name: "Nova Reyes",
      instagram: "novareyes",
      spotify: "spot123",
      x: "novax",
      soundcloud: "https://soundcloud.com/nova",
      youtube: "@nova",
    },
    artistName: "Nova Reyes",
    vaultSources: [
      {
        url: "https://pitchfork.com/x",
        title: "Pitchfork review",
        snippet: "bedroom auteur",
        extractedText: "the review text",
        publishedAt: "2019-01-10",
      },
    ],
    answers: [{ question: "Sound?", answer: "heartbreak you can dance to" }],
    socialCollaborators: [{ handle: "dameatlas", url: "u1" }],
    creditedCollaborators: [],
    selfCredits: [],
    artistStatements: [],
    socialMusicRefs: [],
    ...over,
  }) as unknown as DocMaterial;

beforeEach(() => {
  vi.clearAllMocks();
  m.gatherDocMaterial.mockResolvedValue(material());
  m.catalogBlock.mockResolvedValue("\n--- VERIFIED CATALOG ---");
  m.getDocCorrections.mockResolvedValue([]);
});

describe("buildDocContext", () => {
  it("lays out links, catalog, numbered sources, answers, social signals and the manifest", async () => {
    const { artistName, context, sources } = await buildDocContext("a1");
    expect(artistName).toBe("Nova Reyes");
    expect(sources.map(s => s.id)).toEqual([1, 2, 3]);
    for (const line of [
      "Spotify (verified identity): https://open.spotify.com/artist/spot123",
      "Instagram: https://instagram.com/novareyes",
      "X: https://x.com/novax",
      "SoundCloud: https://soundcloud.com/nova",
      "YouTube: https://youtube.com/@nova",
      "--- VERIFIED CATALOG ---",
      "--- APPROVED SOURCES (about this exact artist) ---",
      "— bedroom auteur — the review text",
      '[2] Q: Sound?\nA (artist\'s own words): "heartbreak you can dance to"',
      "[3] Instagram collaboration with @dameatlas",
      "NUMBERED SOURCES",
    ]) {
      expect(context).toContain(line);
    }
    expect(context).toMatch(
      /\[1\] Source \(published 2019-01-10, \d+ years ago\): Pitchfork review/,
    );
    expect(m.catalogBlock).toHaveBeenCalledWith("spot123");
    expect(context).not.toContain("CORRECTIONS FROM THE ARTIST");
  });

  it("puts the artist's corrections after the material and before the manifest", async () => {
    m.getDocCorrections.mockResolvedValueOnce([
      { id: "c", claim: "He has worked with Black Youngsta", kind: "wrong", correction: null },
    ]);
    const { context } = await buildDocContext("a1");
    expect(context).toMatch(/REMOVE[^\n]*Black Youngsta/);
    expect(context.indexOf("CORRECTIONS FROM THE ARTIST")).toBeLessThan(
      context.indexOf("NUMBERED SOURCES"),
    );
    expect(context.indexOf("SOCIAL SIGNALS")).toBeLessThan(
      context.indexOf("CORRECTIONS FROM THE ARTIST"),
    );
  });

  it("leaves out what the artist doesn't have", async () => {
    m.gatherDocMaterial.mockResolvedValueOnce(
      material({
        artist: {
          id: "a1",
          name: "N",
          instagram: null,
          spotify: null,
          x: null,
          soundcloud: null,
          youtube: null,
        },
        vaultSources: [],
        answers: [],
        socialCollaborators: [],
      }),
    );
    const { context, sources } = await buildDocContext("a1");
    expect(sources).toEqual([]);
    expect(m.catalogBlock).not.toHaveBeenCalled();
    expect(context).toBe("");
  });
});
