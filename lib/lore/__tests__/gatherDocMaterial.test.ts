import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  getVaultSourcesByStatus: vi.fn(),
  getInterviewAnswers: vi.fn(),
  getSocialPostsOrNull: vi.fn(),
  socialSignalSources: vi.fn(),
  captionCreditSources: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.getArtistById }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({
  getVaultSourcesByStatus: m.getVaultSourcesByStatus,
}));
vi.mock("@/lib/lore/getInterviewAnswers", () => ({ getInterviewAnswers: m.getInterviewAnswers }));
vi.mock("@/lib/instagram/getSocialPostsOrNull", () => ({
  getSocialPostsOrNull: m.getSocialPostsOrNull,
}));
vi.mock("@/lib/lore/socialSignalSources", () => ({ socialSignalSources: m.socialSignalSources }));
vi.mock("@/lib/lore/captionCreditSources", () => ({
  captionCreditSources: m.captionCreditSources,
}));
const { gatherDocMaterial } = await import("@/lib/lore/gatherDocMaterial");

const artist = {
  id: "a1",
  name: "Nova Reyes",
  instagram: "novareyes",
  spotify: null,
  x: null,
  soundcloud: null,
  youtube: null,
};
const read = { url: "https://real.example/x", extractedText: "body ".repeat(100) };
const unread = { url: "https://unread.example/y", extractedText: null };
const signals = { socialCollaborators: [{ handle: "d", url: "u" }], socialMusicRefs: [] };
const credits = {
  creditedCollaborators: [],
  selfCredits: [],
  artistStatements: [{ topic: "t", quote: "q", url: "u" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.getArtistById.mockResolvedValue(artist);
  m.getVaultSourcesByStatus.mockResolvedValue([read, unread]);
  m.getInterviewAnswers.mockResolvedValue([
    { question: "Sound?", answer: "heartbreak you can dance to" },
    { question: "Offline?", answer: null },
  ]);
  m.getSocialPostsOrNull.mockResolvedValue([{ url: "p" }]);
  m.socialSignalSources.mockReturnValue(signals);
  m.captionCreditSources.mockResolvedValue(credits);
});

describe("gatherDocMaterial", () => {
  it("reads citable sources, answered questions, social signals and caption credits", async () => {
    expect(await gatherDocMaterial("a1")).toEqual({
      artist,
      artistName: "Nova Reyes",
      vaultSources: [read],
      answers: [{ question: "Sound?", answer: "heartbreak you can dance to" }],
      ...signals,
      ...credits,
    });
    expect(m.socialSignalSources).toHaveBeenCalledWith([{ url: "p" }], "novareyes", "Nova Reyes");
  });

  it("skips social signals with no posts or a failed post read", async () => {
    m.getSocialPostsOrNull.mockResolvedValueOnce(null);
    const material = await gatherDocMaterial("a1");
    expect(m.socialSignalSources).not.toHaveBeenCalled();
    expect(material.socialCollaborators).toEqual([]);
    expect(material.socialMusicRefs).toEqual([]);
  });

  it("names a nameless artist and treats a failed answers read as none", async () => {
    m.getArtistById.mockResolvedValueOnce({ ...artist, name: null, instagram: null });
    m.getInterviewAnswers.mockResolvedValueOnce(null);
    const material = await gatherDocMaterial("a1");
    expect(material.artistName).toBe("Unknown Artist");
    expect(material.answers).toEqual([]);
    expect(m.socialSignalSources).toHaveBeenCalledWith([{ url: "p" }], "", "Unknown Artist");
  });

  it("throws for an artist that does not exist", async () => {
    m.getArtistById.mockResolvedValueOnce(undefined);
    await expect(gatherDocMaterial("nope")).rejects.toThrow("Artist not found: nope");
  });
});
