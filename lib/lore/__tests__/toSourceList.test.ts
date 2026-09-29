import { describe, it, expect } from "vitest";
import { toSourceList } from "@/lib/lore/toSourceList";
import type { DocMaterial } from "@/lib/lore/types";

const vault = (url: string, title: string | null, publishedAt: string | null = null) =>
  ({ url, title, publishedAt }) as unknown as DocMaterial["vaultSources"][number];

const material = (over: Partial<DocMaterial> = {}): DocMaterial => ({
  artist: {
    id: "a1",
    name: "Nova Reyes",
    instagram: null,
    spotify: null,
    x: null,
    soundcloud: null,
    youtube: null,
  },
  artistName: "Nova Reyes",
  vaultSources: [],
  answers: [],
  socialCollaborators: [],
  creditedCollaborators: [],
  selfCredits: [],
  artistStatements: [],
  socialMusicRefs: [],
  ...over,
});

describe("toSourceList", () => {
  it("numbers vault sources best-first, then interview answers, then social signals", () => {
    const sources = toSourceList(
      material({
        vaultSources: [
          vault("https://clubhousedb.com/user/x", "Clubhouse"),
          vault("https://www.discogs.com/a/1", null, "2019-01-01"),
        ],
        answers: [{ question: "Sound?" } as unknown as DocMaterial["answers"][number]],
        socialCollaborators: [{ handle: "dameatlas", url: "u1" }],
        creditedCollaborators: [
          { subject: "someone", isHandle: true, roles: ["Mixed by", "Bass"], url: "u2" },
        ],
        selfCredits: [{ role: "Producer", url: "u3" }],
        artistStatements: [{ topic: "his mother", quote: "q".repeat(200), url: "u4" }],
        socialMusicRefs: [{ title: "Song", artist: "Nova Reyes", url: "u5" }],
      }),
    );
    expect(sources).toEqual([
      {
        id: 1,
        kind: "vault",
        label: "https://www.discogs.com/a/1",
        url: "https://www.discogs.com/a/1",
        publishedAt: "2019-01-01",
      },
      {
        id: 2,
        kind: "vault",
        label: "Clubhouse",
        url: "https://clubhousedb.com/user/x",
        publishedAt: null,
      },
      { id: 3, kind: "interview", label: 'Their own words — "Sound?"', url: null },
      { id: 4, kind: "social", label: "Instagram collaboration with @dameatlas", url: "u1" },
      { id: 5, kind: "social", label: "Nova Reyes credits @someone — Mixed by; Bass", url: "u2" },
      { id: 6, kind: "social", label: "Nova Reyes on their own role — Producer", url: "u3" },
      {
        id: 7,
        kind: "social",
        label: `Their own words — his mother: "${"q".repeat(180)}"`,
        url: "u4",
      },
      { id: 8, kind: "social", label: 'Track credit — "Song" (Nova Reyes)', url: "u5" },
    ]);
  });

  it("writes a bare-name credit without an @", () => {
    const [source] = toSourceList(
      material({
        creditedCollaborators: [
          { subject: "Alan", isHandle: false, roles: ["on guitar"], url: "u" },
        ],
      }),
    );
    expect(source.label).toBe("Nova Reyes credits Alan — on guitar");
  });
});
