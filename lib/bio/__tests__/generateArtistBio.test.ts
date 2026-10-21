import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  hasPinnedBio: vi.fn(),
  getArtistDocStrict: vi.fn(),
  generateAboutFromDoc: vi.fn(),
  persistArtistBio: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mock.getArtistById }));
vi.mock("@/lib/bio/hasPinnedBio", () => ({ hasPinnedBio: mock.hasPinnedBio }));
vi.mock("@/lib/lore/getArtistDocStrict", () => ({ getArtistDocStrict: mock.getArtistDocStrict }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({
  generateAboutFromDoc: mock.generateAboutFromDoc,
}));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: mock.persistArtistBio }));
const { generateArtistBio } = await import("@/lib/bio/generateArtistBio");
const { BioConflictError } = await import("@/lib/bio/BioConflictError");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const auth = { userId: "editor", expectedClaimId: "claim" };
const manifest = [
  { id: 1, kind: "vault", label: "Interview", url: "https://example.org/interview" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mock.getArtistById.mockResolvedValue({ id: "a1", name: "Artist", bio: "Original About" });
  mock.hasPinnedBio.mockResolvedValue(false);
  mock.getArtistDocStrict.mockResolvedValue({ content: "Stored Lore [1]", sources: manifest });
  mock.generateAboutFromDoc.mockResolvedValue("About from Lore [1]");
  mock.persistArtistBio.mockImplementation((_id: string, bio: string) => Promise.resolve(bio));
});

describe("generateArtistBio", () => {
  it("writes the About from the saved Lore only, without its citation markers", async () => {
    expect(await generateArtistBio("a1", auth)).toEqual({
      httpStatus: 200,
      bio: "About from Lore",
    });
    expect(mock.generateAboutFromDoc).toHaveBeenCalledWith("Artist", "Stored Lore [1]", manifest);
    expect(mock.persistArtistBio).toHaveBeenCalledWith("a1", "About from Lore", {
      generated: true,
      expectedBio: "Original About",
      ownership: auth,
    });
  });

  it.each([undefined, { content: "  ", sources: [] }])(
    "without a Lore document it writes nothing: %#",
    async doc => {
      mock.getArtistDocStrict.mockResolvedValue(doc);
      expect(await generateArtistBio("a1", auth)).toEqual({
        httpStatus: 409,
        code: "LORE_REQUIRED",
        error:
          "Build your Lore document before generating About. Your existing About has been kept.",
      });
      expect(mock.generateAboutFromDoc).not.toHaveBeenCalled();
      expect(mock.persistArtistBio).not.toHaveBeenCalled();
    },
  );

  it("returns a pinned bio unchanged without generating", async () => {
    mock.hasPinnedBio.mockResolvedValue(true);
    expect(await generateArtistBio("a1", auth)).toEqual({
      httpStatus: 200,
      bio: "Original About",
      pinned: true,
      message: "Bio is pinned. Unpin it before regenerating.",
    });
    expect(mock.generateAboutFromDoc).not.toHaveBeenCalled();
  });

  it.each([new BioConflictError(), new OwnershipChangedError()])(
    "a write that lost a race or a claim change is a 409: %s",
    async error => {
      mock.persistArtistBio.mockRejectedValue(error);
      expect(await generateArtistBio("a1", auth)).toEqual({
        httpStatus: 409,
        error: error.message,
      });
    },
  );

  it("a failed Lore read is a 500, not an empty document", async () => {
    mock.getArtistDocStrict.mockRejectedValue(new Error("DB offline"));
    expect(await generateArtistBio("a1", auth)).toMatchObject({ httpStatus: 500 });
    expect(mock.persistArtistBio).not.toHaveBeenCalled();
  });

  it("is a 404 for a missing artist", async () => {
    mock.getArtistById.mockResolvedValue(undefined);
    expect(await generateArtistBio("missing", auth)).toEqual({
      httpStatus: 404,
      error: "Artist not found",
    });
  });

  it("a model timeout is a 408 and keeps the About", async () => {
    mock.generateAboutFromDoc.mockRejectedValue(new Error("Gemini timeout"));
    expect(await generateArtistBio("a1", auth)).toEqual({
      httpStatus: 408,
      error: "About generation timed out. Please try again. Your existing About has been kept.",
    });
    expect(mock.persistArtistBio).not.toHaveBeenCalled();
  });

  it.each(["[1]", "[1].", "[1, 2] — …!", "https://example.org/source [1].", "123 [1]"])(
    "keeps the existing bio when cleaning %s leaves no prose",
    async draft => {
      mock.generateAboutFromDoc.mockResolvedValue(draft);
      expect(await generateArtistBio("a1", auth)).toMatchObject({ httpStatus: 500 });
      expect(mock.persistArtistBio).not.toHaveBeenCalled();
    },
  );

  it("cleans links and citations, and accepts non-Latin prose", async () => {
    mock.generateAboutFromDoc.mockResolvedValue(
      "An [ambient trio](https://example.org/trio) records piano [1]. ([Source](https://example.org/source)) More at https://example.org/notes",
    );
    expect(await generateArtistBio("a1", auth)).toEqual({
      httpStatus: 200,
      bio: "An ambient trio records piano. More at",
    });
    mock.generateAboutFromDoc.mockResolvedValue("東京の音楽家です。[1]");
    expect(await generateArtistBio("a1", auth)).toEqual({
      httpStatus: 200,
      bio: "東京の音楽家です。",
    });
  });
});
