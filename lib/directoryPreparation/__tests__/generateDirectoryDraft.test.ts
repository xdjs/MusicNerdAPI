import { it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ generate: vi.fn(), about: vi.fn() }));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generate }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: m.about }));
const { generateDirectoryDraft } = await import("../generateDirectoryDraft");
it("does not invent an About when no original passed assessment", async () => {
  expect(
    await generateDirectoryDraft({ artistName: "Example", startingBio: null, manifest: [] }),
  ).toEqual({ status: "insufficient", document: null, about: null });
  expect(m.generate).not.toHaveBeenCalled();
});
it("numbers the same immutable original for prompt and citations without publishing it", async () => {
  m.generate.mockResolvedValue({ text: "## Overview\nWrites electronic music[1]." });
  m.about.mockResolvedValue("Electronic musician[1].");
  const material = {
    artistName: "Example",
    startingBio: null,
    manifest: [
      {
        id: "s",
        artistId: "a",
        url: "https://example.com",
        title: "Interview",
        extractedText: "Exact original body",
        publishedAt: null,
        status: "pending",
      },
    ],
  };
  expect(await generateDirectoryDraft(material)).toMatchObject({
    status: "ready",
    about: "Electronic musician[1].",
  });
  expect(m.generate.mock.calls[0][0].prompt).toContain("Exact original body");
  expect(m.about.mock.calls[0][2]).toEqual([
    { id: 1, kind: "vault", label: "Interview", url: "https://example.com", publishedAt: null },
  ]);
});
it("rejects a model document without supported citation markers", async () => {
  m.generate.mockResolvedValue({ text: "An unsupported biography." });
  await expect(
    generateDirectoryDraft({
      artistName: "Example",
      startingBio: null,
      manifest: [
        {
          id: "s",
          artistId: "a",
          url: "https://example.com",
          title: null,
          extractedText: "original",
          publishedAt: null,
          status: "pending",
        },
      ],
    }),
  ).rejects.toThrow("cited");
});
