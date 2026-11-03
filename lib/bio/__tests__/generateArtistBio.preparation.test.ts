import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  reserve: vi.fn(),
  doc: vi.fn(),
  synthesize: vi.fn(),
  summary: vi.fn(),
  saveDoc: vi.fn(),
  about: vi.fn(),
  saveAbout: vi.fn(),
  material: vi.fn(),
  settle: vi.fn(),
  fail: vi.fn(),
}));
vi.mock("@/lib/bio/reserveAboutLoreRefresh", () => ({ reserveAboutLoreRefresh: m.reserve }));
vi.mock("@/lib/lore/getArtistDocStrict", () => ({ getArtistDocStrict: m.doc }));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: m.synthesize }));
vi.mock("@/lib/lore/generateLoreSummary", () => ({ generateLoreSummary: m.summary }));
vi.mock("@/lib/lore/persistRefreshedLore", () => ({ persistRefreshedLore: m.saveDoc }));
vi.mock("@/lib/lore/gatherDocMaterial", () => ({ gatherDocMaterial: m.material }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: m.about }));
vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: m.saveAbout }));
vi.mock("@/lib/bio/hasPinnedBio", () => ({ hasPinnedBio: async () => false }));
vi.mock("@/lib/artists/getArtistById", () => ({
  getArtistById: async () => ({ id: "a", name: "New Artist", bio: null }),
}));
vi.mock("@/lib/bio/finishAboutLoreRefresh", () => ({ finishAboutLoreRefresh: m.settle }));
vi.mock("@/lib/research/failResearchJob", () => ({ failResearchJob: m.fail }));
vi.mock("@/lib/db/db", () => ({ db: {} }));
const { generateArtistBio } = await import("../generateArtistBio");
const auth = { userId: "admin", expectedClaimId: null };
const sources = [
  { id: 1, kind: "vault", label: "Artist interview", url: "https://example.org/interview" },
];
beforeEach(() => {
  vi.resetAllMocks();
  m.reserve.mockResolvedValue({
    status: "acquired",
    jobId: "j",
    requestedAt: "",
    claimedAt: "lease",
  });
  m.doc.mockResolvedValue(undefined);
  m.material.mockResolvedValue({
    artist: { name: "New Artist" },
    artistName: "New Artist",
    vaultSources: [
      {
        id: "s",
        title: "Artist interview",
        status: "approved",
        url: "https://example.org/interview",
        extractedText: "Verified readable artist interview. ".repeat(10),
      },
    ],
    answers: [],
    socialCollaborators: [],
    creditedCollaborators: [],
    selfCredits: [],
    artistStatements: [],
    socialMusicRefs: [],
  });
  m.synthesize.mockResolvedValue({ doc: "New Lore [1]", sources });
  m.saveDoc.mockImplementation(async (_id, content, manifest) => {
    m.doc.mockResolvedValue({ content, sources: manifest });
    return true;
  });
  m.settle.mockResolvedValue(true);
  m.about.mockResolvedValue("New About [1]");
  m.saveAbout.mockImplementation(async (_id, bio) => bio);
});
it("takes a newly added artist's approved readable Lore through document persistence and then About", async () => {
  expect(await generateArtistBio("a", auth)).toEqual({ httpStatus: 200, bio: "New About" });
  expect(m.saveDoc).toHaveBeenCalledWith(
    "a",
    "New Lore [1]",
    sources,
    null,
    "j",
    undefined,
    auth,
    {
      jobId: "j",
      requestedAt: "",
      claimedAt: "lease",
    },
    expect.any(AbortSignal),
  );
  expect(m.about).toHaveBeenCalledWith("New Artist", "New Lore [1]", sources, {
    abortSignal: expect.any(AbortSignal),
  });
  expect(m.about.mock.invocationCallOrder[0]).toBeGreaterThan(
    m.saveDoc.mock.invocationCallOrder[0],
  );
  expect(m.saveAbout).toHaveBeenCalledWith("a", "New About", {
    generated: true,
    signal: expect.any(AbortSignal),
    expectedLore: { content: "New Lore [1]", sources },
    expectedBio: null,
    ownership: auth,
  });
});
it("reuses an artist's existing document", async () => {
  m.reserve.mockResolvedValue({ status: "ready" });
  m.doc.mockResolvedValue({ content: "Existing Lore", sources });
  expect(await generateArtistBio("a", auth)).toMatchObject({ httpStatus: 200 });
  expect(m.synthesize).not.toHaveBeenCalled();
  expect(m.about).toHaveBeenCalledWith("New Artist", "Existing Lore", sources, {
    abortSignal: expect.any(AbortSignal),
  });
});
it("reports Lore preparation failure and never starts About", async () => {
  m.synthesize.mockRejectedValue(new Error("provider failed"));
  expect(await generateArtistBio("a", auth)).toMatchObject({
    httpStatus: 500,
    code: "LORE_PREPARATION_FAILED",
  });
  expect(m.about).not.toHaveBeenCalled();
  expect(m.saveAbout).not.toHaveBeenCalled();
});
it("reports About failure without claiming success; prepared Lore remains available", async () => {
  m.about.mockRejectedValue(new Error("provider failed"));
  expect(await generateArtistBio("a", auth)).toMatchObject({
    httpStatus: 500,
    error: expect.stringContaining("generate About"),
  });
  expect(m.saveDoc).toHaveBeenCalledTimes(1);
  expect(m.saveAbout).not.toHaveBeenCalled();
  expect(await m.doc()).toEqual({ content: "New Lore [1]", sources });
});
it("has no model calls or About writes when no usable material is available", async () => {
  m.material.mockResolvedValue({ ...(await m.material()), vaultSources: [] });
  expect(await generateArtistBio("a", auth)).toMatchObject({
    httpStatus: 409,
    code: "LORE_REQUIRED",
  });
  expect(m.synthesize).not.toHaveBeenCalled();
  expect(m.about).not.toHaveBeenCalled();
  expect(m.saveAbout).not.toHaveBeenCalled();
});
