/**
 * Parity: MusicNerdWeb's `turnHandlers.test.ts` (656276a8), ported case for
 * case, driving the whole API turn with only the leaf modules mocked. Each web
 * module the test imports is rebuilt as an object holding the same mocks
 * (OQ = onboardingQueries, AQ = artistQueries, DQ = dashboardQueries, …), so
 * the test bodies read as they do in MusicNerdWeb and assert the same event
 * sequences.
 *
 * Two adapters bridge API signatures: `synthesizeArtistDoc` returns
 * `{ doc, sources }` here (the web mock resolves the doc string), and the
 * web's `requestArtistResearch(artistId)` is `queueSocialIngest(artistId, {})`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** The web test drives mocks with any shape; typed loosely on purpose (tests allow `any`). */
type AnyFn = (...args: any[]) => any;

const m = vi.hoisted(() => ({
  persistArtistBio: vi.fn<AnyFn>(async (_id: string, bio: string) => bio),
  getOnboardingState: vi.fn<AnyFn>(),
  confirmOnboardingStep: vi.fn<AnyFn>(async () => undefined),
  getInterviewAnswers: vi.fn<AnyFn>(async () => []),
  upsertInterviewAnswer: vi.fn<AnyFn>(async () => undefined),
  getArtistById: vi.fn<AnyFn>(async () => ({
    id: "a1",
    name: "Nova Reyes",
    spotify: "spot1",
    instagram: "nova",
  })),
  getAllLinks: vi.fn<AnyFn>(async () => []),
  getVaultSourcesByStatus: vi.fn<AnyFn>(async () => []),
  getVaultSourceByIdAndArtist: vi.fn<AnyFn>(),
  updateVaultSourceStatus: vi.fn<AnyFn>(async () => ({})),
  insertVaultSource: vi.fn<AnyFn>(async () => ({ id: "new-src" })),
  updateVaultSourceContent: vi.fn<AnyFn>(async () => ({})),
  searchAndPopulateVault: vi.fn<AnyFn>(async () => []),
  isUnsafeUrl: vi.fn<AnyFn>(() => false),
  fetchPageContent: vi.fn<AnyFn>(async () => ({
    title: "t",
    snippet: "s",
    extractedText: "e",
    ogImage: null,
  })),
  fetchLinkPreview: vi.fn<AnyFn>(async () => ({ imageUrl: null, title: null })),
  requestArtistResearch: vi.fn<AnyFn>(async () => undefined),
  waitForSocialPosts: vi.fn<AnyFn>(async () => true),
  inferTypeFromUrl: vi.fn<AnyFn>(() => "article"),
  setArtistLink: vi.fn<AnyFn>(async () => ({ oldValue: null, artistName: "Nova" })),
  clearArtistLink: vi.fn<AnyFn>(async () => ({ oldValue: "x" })),
  extractArtistId: vi.fn<AnyFn>(),
  nameIsAmbiguousInDirectory: vi.fn<AnyFn>(async () => false),
  handleBelongsToAnotherArtist: vi.fn<AnyFn>(async () => false),
  contradictsScrapedPosts: vi.fn<AnyFn>(async () => false),
  discoverArtistProfiles: vi.fn<AnyFn>(async () => []),
  discoverArtistProfilesStream: vi.fn<AnyFn>(async function* () {}),
  buildDocSources: vi.fn<AnyFn>(async () => []),
  extractCitedIds: vi.fn<AnyFn>(() => new Set()),
  stripCitationMarkers: vi.fn<AnyFn>((text: string) => text),
  synthesizeArtistDoc: vi.fn<AnyFn>(async () => "## Overview\ndoc"),
  generateAboutFromDoc: vi.fn<AnyFn>(async () => "An About."),
  synthesizeFallbackAbout: vi.fn<AnyFn>(),
  refreshArtistDoc: vi.fn<AnyFn>(),
  generateGroundedQuestions: vi.fn<AnyFn>(async () => []),
  generateText: vi.fn<AnyFn>(async () => ({ text: "mocked gemini response" })),
  getArtistPlatformData: vi.fn<AnyFn>(async () => null),
  // Web-only functions the tests assert are NOT called; nothing in the API calls them.
  upsertArtistDoc: vi.fn<AnyFn>(async () => undefined),
  upsertArtistDocSources: vi.fn<AnyFn>(async () => undefined),
  getArtistDoc: vi.fn<AnyFn>(),
  saveBioVersion: vi.fn<AnyFn>(async () => ({})),
  ensureRecentSocialPosts: vi.fn<AnyFn>(),
  hasSocialPosts: vi.fn<AnyFn>(async () => true),
  dbUpdate: vi.fn<AnyFn>(),
}));

vi.mock("@/lib/bio/persistArtistBio", () => ({ persistArtistBio: m.persistArtistBio }));
vi.mock("@/lib/onboarding/getOnboardingState", () => ({
  getOnboardingState: m.getOnboardingState,
}));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({
  confirmOnboardingStep: m.confirmOnboardingStep,
}));
vi.mock("@/lib/lore/getInterviewAnswers", () => ({ getInterviewAnswers: m.getInterviewAnswers }));
vi.mock("@/lib/onboarding/upsertInterviewAnswer", () => ({
  upsertInterviewAnswer: m.upsertInterviewAnswer,
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.getArtistById }));
vi.mock("@/lib/artists/getAllLinks", () => ({ getAllLinks: m.getAllLinks }));
vi.mock("@/lib/vault/getVaultSourcesByStatus", () => ({
  getVaultSourcesByStatus: m.getVaultSourcesByStatus,
}));
vi.mock("@/lib/vault/getVaultSourceByIdAndArtist", () => ({
  getVaultSourceByIdAndArtist: m.getVaultSourceByIdAndArtist,
}));
vi.mock("@/lib/vault/updateVaultSourceStatus", () => ({
  updateVaultSourceStatus: m.updateVaultSourceStatus,
}));
vi.mock("@/lib/vault/insertVaultSource", () => ({ insertVaultSource: m.insertVaultSource }));
vi.mock("@/lib/vault/updateVaultSourceContent", () => ({
  updateVaultSourceContent: m.updateVaultSourceContent,
}));
vi.mock("@/lib/vault/searchAndPopulateVault", () => ({
  searchAndPopulateVault: m.searchAndPopulateVault,
}));
vi.mock("@/lib/pages/isUnsafeUrl", () => ({ isUnsafeUrl: m.isUnsafeUrl }));
vi.mock("@/lib/pages/fetchPageContent", () => ({ fetchPageContent: m.fetchPageContent }));
vi.mock("@/lib/pages/fetchLinkPreview", () => ({ fetchLinkPreview: m.fetchLinkPreview }));
vi.mock("@/lib/research/queueSocialIngest", () => ({
  queueSocialIngest: (artistId: string) => m.requestArtistResearch(artistId),
}));
vi.mock("@/lib/instagram/waitForSocialPosts", () => ({ waitForSocialPosts: m.waitForSocialPosts }));
vi.mock("@/lib/sources/inferTypeFromUrl", () => ({ inferTypeFromUrl: m.inferTypeFromUrl }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: m.setArtistLink }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink: m.clearArtistLink }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extractArtistId }));
vi.mock("@/lib/identity/nameIsAmbiguousInDirectory", () => ({
  nameIsAmbiguousInDirectory: m.nameIsAmbiguousInDirectory,
}));
vi.mock("@/lib/identity/handleBelongsToAnotherArtist", () => ({
  handleBelongsToAnotherArtist: m.handleBelongsToAnotherArtist,
}));
vi.mock("@/lib/identity/contradictsScrapedPosts", () => ({
  contradictsScrapedPosts: m.contradictsScrapedPosts,
}));
vi.mock("@/lib/discovery/discoverArtistProfilesStream", () => ({
  discoverArtistProfilesStream: m.discoverArtistProfilesStream,
}));
vi.mock("@/lib/lore/buildDocSources", () => ({ buildDocSources: m.buildDocSources }));
vi.mock("@/lib/lore/extractCitedIds", () => ({ extractCitedIds: m.extractCitedIds }));
vi.mock("@/lib/lore/stripCitationMarkers", () => ({
  stripCitationMarkers: m.stripCitationMarkers,
}));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({
  synthesizeArtistDoc: async (...args: any[]) => ({
    doc: await m.synthesizeArtistDoc(...args),
    sources: args[1] ?? [],
  }),
}));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({
  generateAboutFromDoc: m.generateAboutFromDoc,
}));
vi.mock("@/lib/lore/synthesizeFallbackAbout", () => ({
  synthesizeFallbackAbout: m.synthesizeFallbackAbout,
}));
vi.mock("@/lib/questions/generateGroundedQuestions", () => ({
  generateGroundedQuestions: m.generateGroundedQuestions,
}));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generateText }));
vi.mock("@/lib/musicPlatform/getArtistPlatformData", () => ({
  getArtistPlatformData: m.getArtistPlatformData,
}));

const { runOnboardingTurn } = await import("@/lib/onboarding/runOnboardingTurn");
const { applyProfileLinkDecisions } = await import("@/lib/onboarding/applyProfileLinkDecisions");
const { titleMatchesArtist } = await import("@/lib/artists/titleMatchesArtist");
const BIOCONFLICT = await import("@/lib/bio/BioConflictError");
const BIOCONST = await import("@/lib/bio/const");
const { getActiveArtistOperation } = await import("@/lib/ownership/getActiveArtistOperation");

// The web modules the ported bodies import, rebuilt from the API mocks.
const TH = {
  runOnboardingTurn: runOnboardingTurn as AnyFn,
  applyProfileLinkDecisions: applyProfileLinkDecisions as AnyFn,
};
const OQ = {
  ONBOARDING_STEPS: ["profiles", "vault", "interview", "publish"],
  getOnboardingState: m.getOnboardingState,
  confirmOnboardingStep: m.confirmOnboardingStep,
  getInterviewAnswers: m.getInterviewAnswers,
  upsertInterviewAnswer: m.upsertInterviewAnswer,
  upsertArtistDoc: m.upsertArtistDoc,
  upsertArtistDocSources: m.upsertArtistDocSources,
  getArtistDoc: m.getArtistDoc,
};
const AQ = { getArtistById: m.getArtistById, getAllLinks: m.getAllLinks };
const DQ = {
  getVaultSourcesByArtistId: m.getVaultSourcesByStatus,
  getVaultSourceByIdAndArtist: m.getVaultSourceByIdAndArtist,
  updateVaultSourceStatus: m.updateVaultSourceStatus,
  saveBioVersion: m.saveBioVersion,
  insertVaultSource: m.insertVaultSource,
  updateVaultSourceContent: m.updateVaultSourceContent,
};
const VWS = { searchAndPopulateVault: m.searchAndPopulateVault };
const FPC = { isUnsafeUrl: m.isUnsafeUrl, fetchPageContent: m.fetchPageContent };
const LP = { fetchLinkPreview: m.fetchLinkPreview };
const RR = { requestArtistResearch: m.requestArtistResearch };
const SVC = { extractArtistId: m.extractArtistId };
const ALS = { setArtistLink: m.setArtistLink, clearArtistLink: m.clearArtistLink };
const GUARDS = {
  nameIsAmbiguousInDirectory: m.nameIsAmbiguousInDirectory,
  handleBelongsToAnotherArtist: m.handleBelongsToAnotherArtist,
  contradictsScrapedPosts: m.contradictsScrapedPosts,
};
// titleMatchesArtist stays the REAL implementation, as in MusicNerdWeb's test.
const PD = {
  discoverArtistProfiles: m.discoverArtistProfiles,
  discoverArtistProfilesStream: m.discoverArtistProfilesStream,
  titleMatchesArtist,
};
const QG = {
  generateGroundedQuestions: m.generateGroundedQuestions,
  GROUNDED_QUESTION_KEY_PREFIX: "social_",
};
const BIO = { persistArtistBio: m.persistArtistBio };
const DOC = {
  ARTIST_DOC_MAX_CHARS: 20000,
  GEMINI_TIMEOUT_MS: 20000,
  buildDocSources: m.buildDocSources,
  extractCitedIds: m.extractCitedIds,
  stripCitationMarkers: m.stripCitationMarkers,
  synthesizeArtistDoc: m.synthesizeArtistDoc,
  generateAboutFromDoc: m.generateAboutFromDoc,
  synthesizeFallbackAbout: m.synthesizeFallbackAbout,
  refreshArtistDoc: m.refreshArtistDoc,
};
const DRIZZLE = { db: { update: m.dbUpdate } };
const OPCTX = { getActiveArtistOperation };

async function collect(gen: AsyncIterable<any>): Promise<any[]> {
  const events: any[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("runOnboardingTurn", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("open resumes at the derived current step (vault here), never at a fixed start", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    expect(events.find(e => e.kind === "step")?.step).toBe("vault");
  });

  it("a fresh claim builds the whole page without asking anything, and asks no question first", async () => {
    // The claim already established who this is — an admin approved this
    // user on this artist record. Re-asking "is this you?" proves nothing
    // (anyone claiming falsely clicks yes too) and costs a step. Carl,
    // 2026-08-20: "ideally we should create the perfect profile for them
    // without them having to do anything."
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    oq.confirmOnboardingStep.mockClear();
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    // No card is put in front of the artist at all.
    expect(events.some(e => e.kind === "step")).toBe(false);
    expect(events.some(e => e.kind === "complete")).toBe(true);
    expect(events.some(e => e.kind === "error")).toBe(false);

    // Every stage confirms its own step, so a crash mid-build leaves the
    // artist resuming at exactly the stage that failed.
    const confirmed = oq.confirmOnboardingStep.mock.calls.map(c => c[1]);
    expect(confirmed).toEqual(["profiles", "vault"]);
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      expect.any(String),
      expect.objectContaining({ confirmSteps: ["interview", "publish"] }),
    );

    // And it narrates what it's doing rather than sitting silent for a minute.
    const labels = events.filter(e => e.kind === "progress").map(e => e.label);
    expect(labels.some(l => /profiles/i.test(l))).toBe(true);
    expect(labels.some(l => /written about you|sources/i.test(l))).toBe(true);
    expect(labels.some(l => /About/i.test(l))).toBe(true);
  });

  it("auto-build streams the Lore document and the About into the popup as they are written", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const docService = DOC;
    docService.synthesizeArtistDoc.mockImplementationOnce(
      async (_id, _sources, { onTextDelta }) => {
        onTextDelta("## Overview\n");
        await new Promise(resolve => setTimeout(resolve, 0));
        onTextDelta("doc");
        return "## Overview\ndoc";
      },
    );
    docService.generateAboutFromDoc.mockImplementationOnce(
      async (_name, _doc, _sources, { onTextDelta }) => {
        onTextDelta("An ");
        onTextDelta("About.");
        return "An About.";
      },
    );
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    const aboutStage = events.slice(
      events.findIndex(e => e.kind === "progress" && e.label === "Writing your About"),
      events.findIndex(e => e.kind === "progress" && e.label === "Wrote your About") + 1,
    );
    expect(aboutStage.filter(e => e.kind === "text-delta")).toEqual([
      { kind: "text-delta", group: "about-write", call: "doc", delta: "## Overview\n" },
      { kind: "text-delta", group: "about-write", call: "doc", delta: "doc" },
      { kind: "text-delta", group: "about-write", call: "about", delta: "An " },
      { kind: "text-delta", group: "about-write", call: "about", delta: "About." },
    ]);
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "An About.",
      expect.objectContaining({
        document: expect.objectContaining({ content: "## Overview\ndoc" }),
      }),
    );
    expect(events.some(e => e.kind === "complete")).toBe(true);
  });

  it("auto-build still reports a failed Lore document after streaming part of it", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const docService = DOC;
    docService.synthesizeArtistDoc.mockImplementationOnce(
      async (_id, _sources, { onTextDelta }) => {
        onTextDelta("## Over");
        throw new Error("Gemini timeout");
      },
    );
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    expect(events.filter(e => e.kind === "text-delta").map(e => e.delta)).toEqual(["## Over"]);
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(events.some(e => e.kind === "complete")).toBe(false);
    expect(docService.generateAboutFromDoc).not.toHaveBeenCalled();
  });

  it("auto-build publishes when inherited history has reached the explicit-save cap", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const dq = DQ;
    dq.saveBioVersion.mockRejectedValue(new Error("Bio history is full"));
    const { getActiveArtistOperation } = OPCTX;
    const ownership = { userId: "owner", expectedClaimId: "claim-1" };
    const checkpoints: any[] = [];
    oq.confirmOnboardingStep.mockImplementation(async () => {
      checkpoints.push(getActiveArtistOperation());
    });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes", bio: "Existing bio" });
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }, ownership));
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "An About.",
      expect.objectContaining({
        generated: true,
        expectedBio: "Existing bio",
        document: expect.objectContaining({ content: "## Overview\ndoc" }),
      }),
    );
    expect(checkpoints).toEqual(
      Array(2).fill({ artistId: "a1", ...ownership, trigger: "onboarding" }),
    );
    expect(getActiveArtistOperation()).toBeUndefined();
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      expect.any(String),
      expect.objectContaining({ confirmSteps: ["interview", "publish"] }),
    );
    expect(events.some(e => e.kind === "progress" && e.label === "Wrote your About")).toBe(true);
    expect(events.some(e => e.kind === "complete")).toBe(true);
  });

  it.each(["open", "publish"])(
    "a bio conflict in %s never finalizes onboarding or overwrites Lore",
    async type => {
      const oq = OQ;
      oq.getOnboardingState.mockResolvedValue({
        complete: false,
        currentStep: type === "open" ? "profiles" : "publish",
      });
      const { BioConflictError } = BIOCONFLICT;
      const { persistArtistBio } = BIO;
      persistArtistBio.mockRejectedValue(new BioConflictError());
      const { runOnboardingTurn } = TH;
      const ownership = { userId: "owner", expectedClaimId: "original-claim" };
      const run = collect(
        runOnboardingTurn(
          "a1",
          { type, doc: "## Overview\nd", about: "About text", expectedBio: null },
          ownership,
        ),
      );
      if (type === "publish") await expect(run).rejects.toThrow("changed or was pinned");
      else {
        const events = await run;
        expect(events.some(e => e.kind === "error")).toBe(true);
        expect(events.some(e => e.kind === "complete")).toBe(false);
      }
      expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "publish");
      expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
      expect(oq.upsertArtistDocSources).not.toHaveBeenCalled();
      expect(persistArtistBio).toHaveBeenCalledWith(
        "a1",
        expect.any(String),
        expect.objectContaining({ ownership }),
      );
    },
  );

  it("auto-build leaves publication retryable when its atomic persistence fails", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { persistArtistBio } = BIO;
    persistArtistBio.mockRejectedValue(new Error("document write failed"));
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "publish");
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(events.some(e => e.kind === "complete")).toBe(false);
  });

  it("the auto-build runs every identity guard before writing a discovered link, and refuses one they reject", async () => {
    // The guards existed, had their own passing tests, and NOTHING CALLED
    // THEM on this path — the commit that added them said this call site
    // passed `verifyIdentity` and it did not. So this asserts the wiring,
    // not the guards: that the auto-build reaches the module at all, and
    // that a rejection actually stops the write.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    const guards = GUARDS;

    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield {
        kind: "found",
        profile: {
          siteName: "instagram",
          displayName: "Instagram",
          value: "blackdave",
          profileUrl: "https://instagram.com/blackdave",
          logoUrl: null,
          colorHex: null,
          previewImage: null,
          reasoning: "derived from artist name",
        },
      };
    });
    extractArtistId.mockResolvedValue({ siteName: "instagram", id: "blackdave" });
    // The real failure this reproduces: the handle is already recorded
    // against a different artist in the directory.
    guards.handleBelongsToAnotherArtist.mockResolvedValue(true);

    const { runOnboardingTurn } = TH;
    await collect(runOnboardingTurn("a1", { type: "open" }));

    expect(guards.handleBelongsToAnotherArtist).toHaveBeenCalledWith(
      "a1",
      "instagram",
      "blackdave",
    );
    expect(setArtistLink).not.toHaveBeenCalledWith("a1", "instagram", "blackdave");
  });

  it("tells the vault search which columns hold a discovery GUESS, and names only the ones actually written", async () => {
    // The ordering defect: discovery builds a handle out of the artist's
    // name, writes it, and the vault search then skips that column under
    // "already have it" — so its corroborated answer never lands. Black
    // Dave MK2 got instagram=blackdavemk2 that way while blackdave.xyz,
    // which the search alone had found on 8/27, was locked out.
    //
    // `written`, not `discovered`: the identity guards refuse some
    // proposals, and offering the vault a column nothing was written to
    // would be the same lie in the other direction.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const { searchAndPopulateVault } = VWS;
    const guards = GUARDS;

    const profile = (siteName: any, value: any, provisional: any) => ({
      siteName,
      displayName: siteName,
      value,
      provisional,
      profileUrl: `https://${siteName}.com/${value}`,
      logoUrl: null,
      colorHex: null,
      previewImage: null,
      reasoning: null,
    });
    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield { kind: "found", profile: profile("instagram", "blackdavemk2", true) }; // name-derived guess
      yield { kind: "found", profile: profile("youtube", "realchannel", false) }; // propagated, an answer
      yield { kind: "found", profile: profile("soundcloud", "blocked", true) }; // guessed AND refused
    });
    extractArtistId.mockImplementation(async url => {
      const [, siteName, value] = url.match(/https:\/\/(\w+)\.com\/(.+)/);
      return { siteName, id: value };
    });
    guards.handleBelongsToAnotherArtist.mockImplementation(
      async (_id, _site, handle) => handle === "blocked",
    );

    const { runOnboardingTurn } = TH;
    await collect(runOnboardingTurn("a1", { type: "open" }));

    expect(searchAndPopulateVault).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({
        provisionalSiteNames: ["instagram"],
      }),
    );
  });

  it("auto-build tells the research view which profiles it wrote, and which platforms refused to answer", async () => {
    // The view shows discovery's candidates live, then exactly what landed
    // on the artist's row (docs/research-view.md): a profile the identity
    // guards refused, or a second account, must drop out of the cards.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const guards = GUARDS;

    const p = (siteName: any, value: any) => ({
      siteName,
      displayName: siteName,
      value,
      provisional: false,
      profileUrl: `https://${siteName}.com/${value}`,
      logoUrl: null,
      colorHex: null,
      previewImage: null,
      reasoning: null,
    });
    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield { kind: "found", profile: p("spotify", "bio") };
      yield { kind: "found", profile: p("spotify", "second") };
      yield { kind: "found", profile: p("soundcloud", "blocked") };
      yield { kind: "unreachable", siteName: "instagram", displayName: "Instagram" };
    });
    extractArtistId.mockImplementation(async url => {
      const [, siteName, value] = url.match(/https:\/\/(\w+)\.com\/(.+)/);
      return { siteName, id: value };
    });
    guards.handleBelongsToAnotherArtist.mockImplementation(
      async (_id, _site, handle) => handle === "blocked",
    );

    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    const linked = events.filter(e => e.kind === "linked");
    expect(linked).toHaveLength(1);
    expect(linked[0].profiles.map((x: any) => `${x.siteName}=${x.value}`)).toEqual(["spotify=bio"]);
    expect(events.find(e => e.kind === "unreachable")).toEqual({
      kind: "unreachable",
      platforms: ["Instagram"],
    });
    // Said once, in the view; not also as a chat line nobody sees.
    expect(events.some(e => e.kind === "chat" && /let us look/.test(e.text))).toBe(false);
    // Both arrive before the profiles stage reports done.
    const done = events.findIndex(
      e => e.kind === "progress" && e.group === "platform-search" && e.done,
    );
    expect(events.indexOf(linked[0])).toBeLessThan(done);
    expect(events.findIndex(e => e.kind === "unreachable")).toBeLessThan(done);
  });

  it("auto-build shows each source as it is saved, every source on the page when done, and links the search adopted", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { searchAndPopulateVault } = VWS;
    const aq = AQ;
    const dq = DQ;

    const row = (url: any, extra = {}) => ({
      id: url,
      url,
      title: `About ${url}`,
      ogImage: null,
      status: "pending",
      snippet: "s",
      type: "article",
      ...extra,
    });
    let searched = false;
    searchAndPopulateVault.mockImplementationOnce(async (_id, { onSaved }) => {
      onSaved(row("https://a.com/1", { ogImage: "https://a.com/og.jpg" }));
      await new Promise(resolve => setTimeout(resolve, 0));
      onSaved(row("https://b.com/2"));
      searched = true;
      return [];
    });
    aq.getArtistById.mockImplementation(async () =>
      searched
        ? {
            id: "a1",
            name: "Nova Reyes",
            spotify: "spot1",
            instagram: "nova",
            bandcamp: "novareyes",
          }
        : { id: "a1", name: "Nova Reyes", spotify: "spot1", instagram: "nova", bandcamp: null },
    );
    aq.getAllLinks.mockResolvedValue([
      {
        siteName: "bandcamp",
        cardPlatformName: "Bandcamp",
        appStringFormat: "https://%@.bandcamp.com",
      },
    ]);
    dq.getVaultSourcesByArtistId.mockImplementation(async (_id, status) =>
      status === "approved"
        ? [
            row("https://a.com/1", { ogImage: "https://a.com/og.jpg" }),
            row("https://b.com/2"),
            row("https://c.com/old"),
          ]
        : [],
    );

    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    const start = events.findIndex(
      e => e.kind === "progress" && e.group === "source-search" && !e.done,
    );
    const done = events.findIndex(
      e => e.kind === "progress" && e.group === "source-search" && e.done,
    );
    const stage = events.slice(start, done + 1);
    expect(stage.filter(e => e.kind === "source").map(e => e.source)).toEqual([
      { title: "About https://a.com/1", url: "https://a.com/1", ogImage: "https://a.com/og.jpg" },
      { title: "About https://b.com/2", url: "https://b.com/2", ogImage: null },
    ]);
    expect(stage.find(e => e.kind === "sources").sources.map((x: any) => x.url)).toEqual([
      "https://a.com/1",
      "https://b.com/2",
      "https://c.com/old",
    ]);
    expect(stage.find(e => e.kind === "linked").profiles).toEqual([
      expect.objectContaining({
        siteName: "bandcamp",
        value: "novareyes",
        profileUrl: "https://novareyes.bandcamp.com",
      }),
    ]);
    aq.getArtistById.mockReset();
    aq.getArtistById.mockResolvedValue({
      id: "a1",
      name: "Nova Reyes",
      spotify: "spot1",
      instagram: "nova",
    });
    aq.getAllLinks.mockResolvedValue([]);
    dq.getVaultSourcesByArtistId.mockReset();
    dq.getVaultSourcesByArtistId.mockResolvedValue([]);
  });

  it("writes ONE account per platform and offers the other as a choice", async () => {
    // Discovery can now return two accounts for one platform. Passing both
    // to applyProfileLinkDecisions made the LAST one win — the silent
    // arbitrary pick this change exists to remove — so the primary is
    // written and the alternative is sent to the client to ask about.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;

    const p = (siteName: any, value: any) => ({
      siteName,
      displayName: siteName,
      value,
      provisional: false,
      profileUrl: `https://${siteName}.com/${value}`,
      logoUrl: null,
      colorHex: null,
      previewImage: null,
      reasoning: null,
    });
    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield { kind: "found", profile: p("instagram", "blackdave.xyz") }; // primary
      yield { kind: "found", profile: p("instagram", "blackdavemk2") }; // alternative
      yield { kind: "found", profile: p("youtube", "only-one") };
    });
    extractArtistId.mockImplementation(async url => {
      const [, siteName, value] = url.match(/https:\/\/(\w+)\.com\/(.+)/);
      return { siteName, id: value };
    });

    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    const wrote = setArtistLink.mock.calls.map(c => `${c[1]}=${c[2]}`);
    expect(wrote).toContain("instagram=blackdave.xyz");
    expect(wrote).not.toContain("instagram=blackdavemk2");

    const choice = events.find(e => e.kind === "choices");
    expect(choice).toMatchObject({ platform: "instagram", chosen: "blackdave.xyz" });
    expect(choice.options.map((o: any) => o.value)).toEqual(["blackdave.xyz", "blackdavemk2"]);
    // A platform with one candidate is not a question.
    expect(events.filter(e => e.kind === "choices")).toHaveLength(1);
  });

  it("asks about the second account when the VAULT SEARCH replaces what discovery guessed", async () => {
    // The case that actually happens, and the one the discovery-side
    // grouping cannot see. Discovery structurally yields at most one
    // candidate per platform — tier 3 keeps the first confirmed hit, and
    // `missing.delete` stops later tiers revisiting a resolved platform —
    // so Black Dave MK2's two Instagrams never meet inside discovery. One
    // is discovery's name-derived guess (blackdavemk2), the other is the
    // vault search's corroborated find (blackdave.xyz). They meet in his
    // row and nowhere else.
    //
    // Without this the picker was unreachable in production while its unit
    // test passed, because that test mocks the stream to yield two.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const artistQ = AQ;

    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield {
        kind: "found",
        profile: {
          siteName: "instagram",
          displayName: "Instagram",
          value: "blackdavemk2",
          profileUrl: "https://instagram.com/blackdavemk2",
          provisional: true,
          logoUrl: null,
          colorHex: null,
          previewImage: null,
          reasoning: null,
        },
      };
    });
    extractArtistId.mockResolvedValue({ siteName: "instagram", id: "blackdavemk2" });
    artistQ.getAllLinks.mockResolvedValue([
      {
        siteName: "instagram",
        cardPlatformName: "Instagram",
        appStringFormat: "https://instagram.com/%@",
      },
    ]);
    // The row as re-read AFTER the vault search has overwritten the guess.
    artistQ.getArtistById.mockResolvedValue({
      id: "a1",
      name: "Black Dave MK2",
      instagram: "blackdave.xyz",
    });

    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));

    const choice = events.find(e => e.kind === "choices");
    expect(choice).toBeTruthy();
    expect(choice.platform).toBe("instagram");
    expect(choice.chosen).toBe("blackdave.xyz"); // what the search corroborated
    expect(choice.options.map((o: any) => o.value).sort()).toEqual([
      "blackdave.xyz",
      "blackdavemk2",
    ]);
    expect(choice.options.map((o: any) => o.profileUrl)).toContain(
      "https://instagram.com/blackdavemk2",
    );
  });

  it("does not ask when the vault search left the discovered handle alone", async () => {
    // No question to put: one account, one answer. Asking anyway would turn
    // every ordinary build into a quiz.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { extractArtistId } = SVC;
    const artistQ = AQ;

    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield {
        kind: "found",
        profile: {
          siteName: "instagram",
          displayName: "Instagram",
          value: "nova",
          profileUrl: "https://instagram.com/nova",
          provisional: true,
          logoUrl: null,
          colorHex: null,
          previewImage: null,
          reasoning: null,
        },
      };
    });
    extractArtistId.mockResolvedValue({ siteName: "instagram", id: "nova" });
    artistQ.getAllLinks.mockResolvedValue([
      {
        siteName: "instagram",
        cardPlatformName: "Instagram",
        appStringFormat: "https://instagram.com/%@",
      },
    ]);
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes", instagram: "nova" });

    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    expect(events.some(e => e.kind === "choices")).toBe(false);
  });

  it("a link the ARTIST typed is never identity-guarded — only the unattended auto-build is", async () => {
    // The other half of the same rule. Blocking somebody from adding their
    // own Instagram because a similarly named act is in the directory is a
    // worse bug than the one the guards fix, so `confirm_profiles` (and
    // `find_more_profiles`) must stay unguarded. Without this, the obvious
    // "just turn the guards on everywhere" edit passes the test above.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    const guards = GUARDS;
    extractArtistId.mockResolvedValue({ siteName: "instagram", id: "blackdave" });
    guards.handleBelongsToAnotherArtist.mockResolvedValue(true);

    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://instagram.com/blackdave" }],
        removedSiteNames: [],
      }),
    );

    expect(guards.handleBelongsToAnotherArtist).not.toHaveBeenCalled();
    expect(setArtistLink).toHaveBeenCalledWith("a1", "instagram", "blackdave");
  });

  it("a RESUME does not auto-build — it hands back the step the artist stopped on", async () => {
    // Mid-flow means something failed or they stepped away; the
    // step-by-step cards are the right way back in, not a silent rebuild.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    oq.confirmOnboardingStep.mockClear();
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    expect(events.some(e => e.kind === "step" && e.step === "vault")).toBe(true);
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalled();
  });

  it("profiles step enriches links with urlmap metadata (display name, logo, trimmed color, profile URL)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getAllLinks.mockResolvedValueOnce([
      {
        siteName: "spotify",
        cardPlatformName: "Spotify",
        siteImage: "https://utfs.io/f/spotify.png",
        colorHex: "#1DB954",
        appStringFormat: "https://open.spotify.com/artist/%@",
      },
      {
        siteName: "instagram",
        cardPlatformName: "Instagram",
        siteImage: null,
        colorHex: "#E1306C\r",
        appStringFormat: "https://instagram.com/%@",
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const step = events.find(e => e.kind === "step");
    expect(step.payload.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          siteName: "spotify",
          value: "spot1",
          displayName: "Spotify",
          logoUrl: "https://utfs.io/f/spotify.png",
          colorHex: "#1DB954",
          profileUrl: "https://open.spotify.com/artist/spot1",
        }),
        expect.objectContaining({
          siteName: "instagram",
          value: "nova",
          displayName: "Instagram",
          logoUrl: null,
          colorHex: "#E1306C", // trailing \r trimmed
          profileUrl: "https://instagram.com/nova",
        }),
      ]),
    );
  });

  it("profiles step fetches link previews in parallel for every link with a profileUrl and attaches previewImage", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getAllLinks.mockResolvedValueOnce([
      {
        siteName: "spotify",
        cardPlatformName: "Spotify",
        siteImage: "https://utfs.io/f/spotify.png",
        colorHex: "#1DB954",
        appStringFormat: "https://open.spotify.com/artist/%@",
      },
      {
        siteName: "instagram",
        cardPlatformName: "Instagram",
        siteImage: null,
        colorHex: null,
        appStringFormat: "https://instagram.com/%@",
      },
    ]);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockImplementation(async url =>
      url.includes("spotify")
        ? { imageUrl: "https://i.scdn.co/image/spot1.jpg", title: "Nova Reyes" }
        : { imageUrl: null, title: null },
    );
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const step = events.find(e => e.kind === "step");
    expect(fetchLinkPreview).toHaveBeenCalledWith("https://open.spotify.com/artist/spot1");
    expect(fetchLinkPreview).toHaveBeenCalledWith("https://instagram.com/nova");
    const spotifyLink = step.payload.links.find((l: any) => l.siteName === "spotify");
    const instagramLink = step.payload.links.find((l: any) => l.siteName === "instagram");
    expect(spotifyLink.previewImage).toBe("https://i.scdn.co/image/spot1.jpg");
    expect(instagramLink.previewImage).toBeNull();
  });

  it('profiles step normalizes the urlmap placeholder color (#000000, meaning "never set") to null', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getAllLinks.mockResolvedValueOnce([
      {
        siteName: "spotify",
        cardPlatformName: "Spotify",
        siteImage: null,
        colorHex: "#000000",
        appStringFormat: "https://open.spotify.com/artist/%@",
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const step = events.find(e => e.kind === "step");
    const spotifyLink = step.payload.links.find((l: any) => l.siteName === "spotify");
    expect(spotifyLink.colorHex).toBeNull();
  });

  it("profiles step degrades to the bare {siteName, value} shape when getAllLinks throws (urlmap failure must never break the turn)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getAllLinks.mockRejectedValueOnce(new Error("urlmap down"));
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const step = events.find(e => e.kind === "step");
    expect(step.payload.links).toEqual([
      { siteName: "spotify", value: "spot1" },
      { siteName: "instagram", value: "nova" },
    ]);
    expect(events.some(e => e.kind === "error")).toBe(false);
  });

  it("profiles step narrates the empty variant when the artist has zero links, and the populated variant otherwise", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValueOnce({ id: "a1", name: "Nova Reyes" }); // no link columns set
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("Paste your Spotify"))).toBe(true);
    expect(chats.some(t => t.includes("Leaving a card as-is confirms it"))).toBe(false);
  });

  it("profiles step (fresh open) streams discovery, merges candidates into the payload, and narrates the found count", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const candidate = {
      siteName: "tiktok",
      displayName: "TikTok",
      value: "novareyes",
      profileUrl: "https://tiktok.com/@novareyes",
      logoUrl: null,
      colorHex: null,
      previewImage: null,
      reasoning: "Matches the artist name and bio.",
    };
    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield { kind: "searching", platform: "tiktok", displayName: "TikTok" };
      yield { kind: "found", profile: candidate };
      yield { kind: "checked", platform: "tiktok", displayName: "TikTok" };
    });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    expect(discoverArtistProfilesStream).toHaveBeenCalledWith("a1");
    // The incremental `candidate` event fires as its own frame, ahead of
    // the terminal `step` event — additive live feedback, not the only
    // source of the candidate.
    expect(events.some(e => e.kind === "candidate" && e.profile.siteName === "tiktok")).toBe(true);
    const step = events.find(e => e.kind === "step");
    expect(step.payload.candidates).toEqual([candidate]);
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("1 more profile") && /confirm/i.test(t))).toBe(true);
  });

  it('profiles step collapses every per-platform "searching" event into ONE group-tagged progress line that only grows on a genuinely new platform, and settles to done exactly once after discovery is fully exhausted', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    // Out-of-order-feeling stream: instagram is searched THREE times (tier
    // probe, then re-probed twice more as confirmed handles propagate —
    // mirrors the real "Instagram searched 3x in one run" behavior), and
    // no "checked" events are emitted (the real generator does emit them,
    // but the client-facing collapse no longer keys off them at all).
    discoverArtistProfilesStream.mockImplementationOnce(async function* () {
      yield { kind: "searching", platform: "spotify", displayName: "Spotify" };
      yield { kind: "searching", platform: "instagram", displayName: "Instagram" };
      yield { kind: "checked", platform: "spotify", displayName: "Spotify" };
      yield { kind: "searching", platform: "instagram", displayName: "Instagram" }; // repeat #2
      yield { kind: "checked", platform: "instagram", displayName: "Instagram" };
      yield { kind: "searching", platform: "tiktok", displayName: "TikTok" };
      yield { kind: "searching", platform: "instagram", displayName: "Instagram" }; // repeat #3
      yield { kind: "checked", platform: "tiktok", displayName: "TikTok" };
      yield { kind: "checked", platform: "instagram", displayName: "Instagram" };
    });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );

    const groupEvents = events.filter(e => e.kind === "progress" && e.group === "platform-search");
    // 3 DISTINCT platforms (spotify, instagram, tiktok) → exactly 3
    // "grew the count" emissions while running, plus exactly one closing
    // "done" emission — the 2 instagram repeats emit nothing extra.
    expect(groupEvents).toHaveLength(4);
    expect(groupEvents.slice(0, 3).map(e => e.label)).toEqual([
      "Searching 1 platform…",
      "Searching 2 platforms…",
      "Searching 3 platforms…",
    ]);
    expect(groupEvents.slice(0, 3).every(e => e.done === false)).toBe(true);
    // Settles to done EXACTLY once, after the generator is fully drained —
    // never inferred from a mid-stream lull.
    const doneEvents = groupEvents.filter(e => e.done === true);
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].label).toBe("Searched 3 platforms");

    // The closing group event is the LAST progress event emitted for the
    // step — i.e. it fires only after the whole discovery stream drains,
    // not interleaved mid-stream.
    const profileStepProgress = events.filter(
      e =>
        e.kind === "progress" &&
        (e.group === "platform-search" || e.label === "Gathering your profiles"),
    );
    expect(profileStepProgress[profileStepProgress.length - 1]).toBe(doneEvents[0]);

    // Ungrouped progress chips (the step-entry "Gathering your profiles"
    // pair) are completely unaffected — no `group` field at all.
    const gathering = events.filter(
      e => e.kind === "progress" && e.label === "Gathering your profiles",
    );
    expect(gathering).toHaveLength(2);
    expect(gathering.every(e => e.group === undefined)).toBe(true);
  });

  it("profiles step emits no group-search progress at all when discovery never searches any platform (nothing missing to search for)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    // Default mock (from the top-level vi.mock) is an empty generator —
    // no "searching" events at all.
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    expect(events.some(e => e.kind === "progress" && e.group === "platform-search")).toBe(false);
  });

  it("profiles step (fresh open) sets candidates to an empty array and skips the found-count narration when discovery finds nothing", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    const step = events.find(e => e.kind === "step");
    expect(step.payload.candidates).toEqual([]);
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => /found \d+ more/i.test(t))).toBe(false);
  });

  it("does NOT run discovery when resuming on a non-profiles step", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const { discoverArtistProfiles } = PD;
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", { type: "find_more_profiles", addedLinks: [], removedSiteNames: [] }),
    );
    expect(discoverArtistProfiles).not.toHaveBeenCalled();
  });

  it("does NOT re-run discovery on the Bug-2 retry re-emission of the profiles step", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes" }); // zero links throughout
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined); // unrecognized -> all additions fail
    const { discoverArtistProfiles } = PD;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://www.instagram.com/" }],
        removedSiteNames: [],
      }),
    );
    expect(events.some(e => e.kind === "step" && e.step === "profiles")).toBe(true); // re-emitted, per Bug 2
    expect(discoverArtistProfiles).not.toHaveBeenCalled();
  });

  it("confirm_profiles: an accepted discovery candidate URL round-trips through extractArtistId + setArtistLink exactly like a pasted link (end-to-end contract check)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes", tiktok: "novareyes" }); // reflects the successful write
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    extractArtistId.mockResolvedValueOnce({
      siteName: "tiktok",
      cardPlatformName: "TikTok",
      id: "novareyes",
    });
    const { runOnboardingTurn } = TH;
    // The client sends an accepted candidate the exact same way it sends a
    // pasted link — a bare {url} in addedLinks (spec: no server contract change).
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://tiktok.com/@novareyes" }],
        removedSiteNames: [],
      }),
    );
    expect(setArtistLink).toHaveBeenCalledWith("a1", "tiktok", "novareyes");
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "error")).toBe(false);
  });

  it("confirm_profiles writes added links via extractArtistId and reports bad URLs politely", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    extractArtistId
      .mockResolvedValueOnce({ siteName: "tiktok", cardPlatformName: "TikTok", id: "novareyes" })
      .mockResolvedValueOnce(undefined); // unrecognized URL
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [
          { url: "https://tiktok.com/@novareyes" },
          { url: "https://nonsense.example/xyz" },
        ],
        removedSiteNames: [],
      }),
    );
    expect(setArtistLink).toHaveBeenCalledWith("a1", "tiktok", "novareyes");
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "chat" && e.text.includes("couldn't recognize"))).toBe(true);
    expect(events.some(e => e.kind === "error")).toBe(false); // degradation, not failure
  });

  it("confirm_profiles: all additions fail and the artist still has zero links — does NOT confirm/advance, re-emits the profiles step (Bug 2)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes" }); // zero link columns, before AND after the writes
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    extractArtistId
      .mockResolvedValueOnce(undefined) // unrecognized: no username in the URL
      .mockResolvedValueOnce({ siteName: "tiktok", cardPlatformName: "TikTok", id: "novareyes" }); // recognized, write rejected
    setArtistLink.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "artists_tiktok_unique"'),
    );
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [
          { url: "https://www.instagram.com/" },
          { url: "https://tiktok.com/@novareyes" },
        ],
        removedSiteNames: [],
      }),
    );
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "step" && e.step === "profiles")).toBe(true);
    expect(events.some(e => e.kind === "chat" && e.text.includes("Profiles confirmed"))).toBe(
      false,
    );
    expect(events.some(e => e.kind === "error")).toBe(false); // recovery is a re-emitted step, not an error event
    // The closing line must match what actually happens next: on the
    // blocked path (re-emitting the step) it invites a retry paste, NOT
    // the "add it later from Links" copy that only makes sense on
    // the confirm-and-advance path (the closing-line bug the advisor flagged).
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("I'll try again"))).toBe(true);
    expect(chats.some(t => t.includes("Links section"))).toBe(false);
  });

  it("confirm_profiles: at least one addition succeeds — confirms the step and advances to vault as before", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes", instagram: "nova" }); // reflects the successful write
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce({
      siteName: "instagram",
      cardPlatformName: "Instagram",
      id: "nova",
    });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://instagram.com/nova" }],
        removedSiteNames: [],
      }),
    );
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "chat" && e.text.includes("Profiles confirmed"))).toBe(true);
    expect(events.some(e => e.kind === "step" && e.step === "vault")).toBe(true);
  });

  it("confirm_profiles: zero additions submitted and the artist has zero links — blank-slate skip still confirms and advances", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes" }); // zero links, nothing submitted either
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [],
        removedSiteNames: [],
      }),
    );
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "chat" && e.text.includes("Profiles confirmed"))).toBe(true);
    expect(events.some(e => e.kind === "step" && e.step === "vault")).toBe(true);
  });

  it("confirm_profiles: distinguishes an unrecognized URL from a write that was rejected (Bug 3)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova Reyes", spotify: "spot1" }); // pre-existing link keeps this on the "confirm" path
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    extractArtistId
      .mockResolvedValueOnce(undefined) // unrecognized: bare instagram.com with no username
      .mockResolvedValueOnce({ siteName: "tiktok", cardPlatformName: "TikTok", id: "novareyes" }); // recognized, write rejected
    setArtistLink.mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint"),
    );
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [
          { url: "https://www.instagram.com/" },
          { url: "https://tiktok.com/@novareyes" },
        ],
        removedSiteNames: [],
      }),
    );
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    const unrecognizedMsg = chats.find(t => t.includes("instagram.com"));
    const writeRejectedMsg = chats.find(t => t.includes("tiktok.com"));
    expect(unrecognizedMsg).toBeDefined();
    expect(writeRejectedMsg).toBeDefined();
    expect(unrecognizedMsg).not.toBe(writeRejectedMsg);
    expect(unrecognizedMsg).toMatch(/recognize/i);
    expect(writeRejectedMsg).toMatch(/save/i);
    expect(writeRejectedMsg).not.toMatch(/recognize/i);
    // This turn advances to vault (a pre-existing link means it's not the
    // all-failed/blocked path) — the closing line must point to
    // Links, NOT invite a paste-and-retry that has nowhere to land once
    // "Profiles confirmed" and the vault card have already been sent.
    expect(unrecognizedMsg).toContain("Links section");
    expect(writeRejectedMsg).toContain("Links section");
    expect(unrecognizedMsg).not.toContain("I'll try again");
  });

  it("confirm_profiles: a URL that fails platform extraction but resolves to a real page becomes a vault source, approved when the title matches the artist's name, with no \"couldn't recognize\" message", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined); // not a recognized platform URL
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" });
    const dq = DQ;
    const { fetchPageContent } = FPC;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://novareyesmusic.com/" }],
        removedSiteNames: [],
      }),
    );
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://novareyesmusic.com/",
      title: "Nova Reyes — Official Site",
      type: "website",
      status: "approved",
    });
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("couldn't recognize"))).toBe(false);
    expect(chats.some(t => t.includes("added it as a source for your About"))).toBe(true);
    expect(events.some(e => e.kind === "error")).toBe(false);
    // Confirms and advances like any other successful addition.
    const oqMod = OQ;
    expect(oqMod.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    // The authorized insert owns durable ingestion; this turn must not detach a body write.
    expect(fetchPageContent).not.toHaveBeenCalled();
    expect(dq.updateVaultSourceContent).not.toHaveBeenCalled();
  });

  it("confirm_profiles: a bare website domain is normalized before fetch and persistence", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined); // not a recognized platform URL
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" });
    const dq = DQ;
    const { fetchPageContent } = FPC;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "  novareyesmusic.com/  " }],
        removedSiteNames: [],
      }),
    );
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://novareyesmusic.com/",
      title: "Nova Reyes — Official Site",
      type: "website",
      status: "approved",
    });
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("couldn't recognize"))).toBe(false);
    expect(chats.some(t => t.includes("added it as a source for your About"))).toBe(true);
    expect(events.some(e => e.kind === "error")).toBe(false);
    // Confirms and advances like any other successful addition.
    const oqMod = OQ;
    expect(oqMod.confirmOnboardingStep).toHaveBeenCalledWith("a1", "profiles");
    // The authorized insert owns durable ingestion; this turn must not detach a body write.
    expect(fetchPageContent).not.toHaveBeenCalled();
    expect(dq.updateVaultSourceContent).not.toHaveBeenCalled();
  });

  it("confirm_profiles → vault: a website routed to the vault this turn does not suppress the web-discovery search for OTHER sources (forceVaultDiscovery)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" });
    const dq = DQ;
    // Simulate the DB actually reflecting our own insert by the time the
    // vault step's emitStep re-reads it: the dedupe pre-check (no status
    // arg) sees nothing yet, but the subsequent pending/approved reads
    // (inside emitStep's vault case) see the approved row that was just
    // written — exactly what a real Postgres round-trip would show.
    dq.getVaultSourcesByArtistId
      .mockResolvedValueOnce([]) // confirm_profiles dedupe pre-check
      .mockResolvedValueOnce([]) // emitStep vault case: pending
      .mockResolvedValueOnce([
        { id: "new-src", url: "https://novareyesmusic.com/", status: "approved" },
      ]); // emitStep vault case: approved
    const { searchAndPopulateVault } = VWS;
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://novareyesmusic.com/" }],
        removedSiteNames: [],
      }),
    );
    // Without forceVaultDiscovery, approved.length > 0 would short-circuit
    // discovery entirely — the artist's own site would be mistaken for
    // "the vault has already been searched" and every OTHER source about
    // them (press, interviews, reviews) would silently never be found.
    // Matched on the artist, not the whole argument list: the second
    // argument is the caller's deadline, which is a timestamp and would
    // pin this test to an implementation detail it does not care about.
    expect((searchAndPopulateVault as any).mock.calls[0]?.[0]).toBe("a1");
  });

  it("confirm_profiles: resubmitting the same website URL (e.g. a reconnect) is idempotent — no duplicate vault source", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    const dq = DQ;
    // The dedupe pre-check finds the URL already vaulted from an earlier
    // attempt at this same turn (or an identical prior submission).
    dq.getVaultSourcesByArtistId.mockResolvedValueOnce([
      { id: "existing-src", url: "https://novareyesmusic.com/", status: "approved" },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://novareyesmusic.com/" }],
        removedSiteNames: [],
      }),
    );
    expect(fetchLinkPreview).not.toHaveBeenCalledWith("https://novareyesmusic.com/");
    expect(dq.insertVaultSource).not.toHaveBeenCalled();
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("couldn't recognize"))).toBe(false);
    expect(chats.some(t => t.includes("added it as a source for your About"))).toBe(true);
  });

  it('confirm_profiles: a vault insert failure reports a save problem, not "couldn\'t recognize" (the link WAS recognized as a real page)', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" });
    const dq = DQ;
    dq.insertVaultSource.mockRejectedValueOnce(new Error("db boom"));
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://novareyesmusic.com/" }],
        removedSiteNames: [],
      }),
    );
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    const failureMsg = chats.find(t => t.includes("novareyesmusic.com"));
    expect(failureMsg).toBeDefined();
    expect(failureMsg).not.toMatch(/couldn't recognize/);
    expect(failureMsg).toMatch(/couldn't save/i);
  });

  it("confirm_profiles: a resolved page whose title does NOT match the artist's name is routed to the vault as pending, not approved", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({
      imageUrl: "https://example.com/og.jpg",
      title: "Totally Unrelated Blog",
    });
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://example.com/blog" }],
        removedSiteNames: [],
      }),
    );
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://example.com/blog",
      title: "Totally Unrelated Blog",
      type: "article",
      status: "pending",
    });
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("couldn't recognize"))).toBe(false);
    // Pending (no ownership evidence) gets the hedged copy, NOT the
    // "it looks like your site" claim — that's reserved for a real match.
    expect(chats.some(t => t.includes("added it as a possible source for your About"))).toBe(true);
    expect(chats.some(t => t.includes("it looks like your site"))).toBe(false);
  });

  it("confirm_profiles: the artist's own site is typed 'website' while a third-party page stays 'article' — the ownership signal is recorded, not discarded", async () => {
    // inferTypeFromUrl is mocked to ALWAYS return 'article' (see the module
    // mock at the top of this file), so a 'website' result can only come
    // from the ownedByArtist override — that's what this pins.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview
      .mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" })
      .mockResolvedValueOnce({ imageUrl: null, title: "Totally Unrelated Blog" });
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://novareyesmusic.com/" }, { url: "https://example.com/blog" }],
        removedSiteNames: [],
      }),
    );
    // Title carries the artist's name -> their official site.
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://novareyesmusic.com/",
      title: "Nova Reyes — Official Site",
      type: "website",
      status: "approved",
    });
    // No ownership evidence -> unchanged behaviour, still a pending article.
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://example.com/blog",
      title: "Totally Unrelated Blog",
      type: "article",
      status: "pending",
    });
  });

  it("confirm_profiles: kicks off the Instagram ingest as background work once the step is confirmed", async () => {
    // Regression guard for the bug found with a real artist: ingestion was
    // only ever run by a manual CLI script, so grounded interview questions
    // fired solely for artists whose posts had been hand-seeded.
    //
    // The turn now ENQUEUES rather than running the work: after() shares
    // this invocation's maxDuration, which is sixty seconds against a job
    // that needs minutes. What must still be true is that confirming
    // profiles asks for the research to happen.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce({ siteName: "instagram", id: "nova" });
    const { requestArtistResearch } = RR;
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://instagram.com/nova" }],
        removedSiteNames: [],
      }),
    );
    expect(requestArtistResearch).toHaveBeenCalledWith("a1");
  });

  it("confirm_profiles: does NOT start an ingest when every addition failed and the step is re-emitted", async () => {
    // The early return means the artist is still on the profiles step with
    // no saved links — there is no confirmed handle to scrape, and paying
    // for an Apify run here would be wasted.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const aq = AQ;
    aq.getArtistById.mockResolvedValueOnce({ id: "a1", name: "Nova Reyes" }); // no link columns set
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: null }); // dead link -> unrecognized
    const { requestArtistResearch } = RR;
    (requestArtistResearch as any).mockClear();
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://deadsite.example/gone" }],
        removedSiteNames: [],
      }),
    );
    expect(requestArtistResearch).not.toHaveBeenCalled();
  });

  it("confirm_profiles: a dead/unfetchable URL still produces the (corrected) failure message, no longer overclaiming Links support", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    // fetchLinkPreview default mock already resolves { imageUrl: null, title: null } — no real page.
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://deadsite.example/gone" }],
        removedSiteNames: [],
      }),
    );
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    const failureMsg = chats.find(t => t.includes("deadsite.example"));
    expect(failureMsg).toBeDefined();
    expect(failureMsg).toMatch(/couldn't recognize/);
    // The fix: no longer unconditionally promises Links support —
    // it's hedged, since urlmap has no generic website platform.
    expect(failureMsg).toContain("if it's on a platform we support");
    expect(failureMsg).toContain("Links section");
    expect(dq.insertVaultSource).not.toHaveBeenCalled();
    expect(chats.some(t => t.includes("added it as a source"))).toBe(false);
  });

  it("confirm_profiles: an unsafe URL is rejected by isUnsafeUrl before any fetch is attempted", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce(undefined);
    const { isUnsafeUrl, fetchPageContent } = FPC;
    isUnsafeUrl.mockReturnValueOnce(true);
    const { fetchLinkPreview } = LP;
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "http://169.254.169.254/latest/meta-data" }],
        removedSiteNames: [],
      }),
    );
    expect(fetchLinkPreview).not.toHaveBeenCalledWith("http://169.254.169.254/latest/meta-data");
    expect(fetchPageContent).not.toHaveBeenCalledWith("http://169.254.169.254/latest/meta-data");
    expect(dq.insertVaultSource).not.toHaveBeenCalled();
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("169.254.169.254") && t.includes("couldn't recognize"))).toBe(
      true,
    );
  });

  it("confirm_profiles: a recognized platform URL and a fetchable non-platform URL in the same turn are each routed correctly (no interference)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    const { setArtistLink } = ALS;
    extractArtistId
      .mockResolvedValueOnce({ siteName: "instagram", cardPlatformName: "Instagram", id: "nova" }) // recognized
      .mockResolvedValueOnce(undefined); // not a platform — the artist's own site
    const { fetchLinkPreview } = LP;
    fetchLinkPreview.mockResolvedValueOnce({ imageUrl: null, title: "Nova Reyes — Official Site" });
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://instagram.com/nova" }, { url: "https://novareyesmusic.com/" }],
        removedSiteNames: [],
      }),
    );
    // Platform link: existing behavior, untouched.
    expect(setArtistLink).toHaveBeenCalledWith("a1", "instagram", "nova");
    // Non-platform link: routed to the vault, approved (name match).
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://novareyesmusic.com/",
      title: "Nova Reyes — Official Site",
      type: "website",
      status: "approved",
    });
    const chats = events.filter(e => e.kind === "chat").map(e => e.text);
    expect(chats.some(t => t.includes("couldn't recognize"))).toBe(false);
    expect(events.some(e => e.kind === "error")).toBe(false);
  });

  it("vault step passes each pending source's ogImage (or null) through into the payload", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const dq = DQ;
    dq.getVaultSourcesByArtistId.mockResolvedValueOnce([
      // Read page → verified → citable, and the card says so.
      {
        id: "s1",
        title: "Pitchfork review",
        url: "https://pitchfork.com/x",
        snippet: "snip",
        ogImage: "https://pitchfork.com/img.jpg",
        extractedText: "review body ".repeat(50),
      },
      // Never read → shown as an unverified lead, never cited.
      {
        id: "s2",
        title: "Fan wiki",
        url: "https://wiki.example/y",
        snippet: null,
        ogImage: null,
        extractedText: null,
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const step = events.find(e => e.kind === "step" && e.step === "vault");
    expect(step.payload.sources).toEqual([
      {
        id: "s1",
        title: "Pitchfork review",
        url: "https://pitchfork.com/x",
        snippet: "snip",
        ogImage: "https://pitchfork.com/img.jpg",
        verified: true,
      },
      {
        id: "s2",
        title: "Fan wiki",
        url: "https://wiki.example/y",
        snippet: null,
        ogImage: null,
        verified: false,
      },
    ]);
  });

  // Fix 4: the narration states the scale up front, correctly pluralized,
  // so the artist knows how much there is before the card renders.
  it("vault narration states the correct pluralized source count (many sources)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const dq = DQ;
    dq.getVaultSourcesByArtistId.mockResolvedValueOnce(
      Array.from({ length: 11 }, (_, i) => ({
        id: `s${i}`,
        title: `Source ${i}`,
        url: `https://example.com/${i}`,
        snippet: null,
        ogImage: null,
      })),
    );
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const chat = events.find(e => e.kind === "chat" && /found/i.test(e.text));
    expect(chat.text).toContain("We found 11 sources about you.");
  });

  it('vault narration uses singular "source" for exactly one source', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const dq = DQ;
    dq.getVaultSourcesByArtistId.mockResolvedValueOnce([
      {
        id: "s1",
        title: "Pitchfork review",
        url: "https://pitchfork.com/x",
        snippet: "snip",
        ogImage: null,
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const chat = events.find(e => e.kind === "chat" && /found/i.test(e.text));
    expect(chat.text).toContain("We found 1 source about you.");
  });

  // Blocker 1 (pre-demo review): searchAndPopulateVault can hang for tens of
  // seconds with no timeout of its own. The vault step must not inherit that
  // hang — it's raced against VAULT_DISCOVERY_BUDGET_MS so the turn always
  // reaches the empty-state degrade path (paste-a-link) rather than stalling
  // the stream. The cap must stay under the route's 55s turn deadline.
  it("vault: an unresolved searchAndPopulateVault still proceeds to the empty-state narration after the discovery cap, not before", async () => {
    vi.useFakeTimers();
    try {
      const oq = OQ;
      oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
      const vw = VWS;
      vw.searchAndPopulateVault.mockImplementationOnce(() => new Promise(() => {})); // never resolves
      const { runOnboardingTurn } = TH;

      const eventsPromise = collect(runOnboardingTurn("a1", { type: "open" }));
      await vi.advanceTimersByTimeAsync(45_000);
      const events = await eventsPromise;

      // Substring, not the exact sentence: this test is about WHEN the
      // empty-state narration fires (after the discovery cap, not before),
      // and pinning the full prose made a copy edit look like a
      // behavioural regression.
      expect(
        events.some(
          e => e.kind === "chat" && e.text.includes("didn't find much about you on the web"),
        ),
      ).toBe(true);
      expect(
        events.some(e => e.kind === "step" && e.step === "vault" && e.payload.sources.length === 0),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("vault_review only updates sources belonging to this artist", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const dq = DQ;
    dq.getVaultSourceByIdAndArtist
      .mockResolvedValueOnce({ id: "s1", artistId: "a1" })
      .mockResolvedValueOnce(undefined); // someone else's source id
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "vault_review",
        decisions: [
          { sourceId: "s1", status: "approved" },
          { sourceId: "evil", status: "approved" },
        ],
      }),
    );
    expect(dq.updateVaultSourceStatus).toHaveBeenCalledTimes(1);
    expect(dq.updateVaultSourceStatus).toHaveBeenCalledWith("s1", "approved");
  });

  it("interview_answer stores the answer, then asks the next unanswered question; last answer confirms the step and enters publish (draft generated)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([
      { questionKey: "sound_in_own_words", answer: "a" },
      { questionKey: "offline_fact", answer: null },
      { questionKey: "working_on_now", answer: "b" },
    ]); // all three asked → step complete
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "working_on_now",
        answer: "new album",
      }),
    );
    expect(oq.upsertInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "a1",
        questionKey: "working_on_now",
        answer: "new album",
        source: "onboarding",
      }),
    );
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "interview");
    // The publish step now opens with the knowledge document ALONE — the About
    // is written only after the artist has read and approved the document.
    expect(
      events.some(e => e.kind === "draft" && e.stage === "doc" && e.doc && e.about === null),
    ).toBe(true);
  });

  it("interview step prefers a grounded question over the static bank when generation returns one, and carries its sourceUrls into the step payload", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([]); // nothing asked yet
    const { generateGroundedQuestions } = QG;
    generateGroundedQuestions.mockResolvedValueOnce([
      {
        key: "social_collaborator_dameatlas",
        question: "You and @dameatlas put out a track together — what's the story?",
        rationale: "real collab",
        sourceUrls: ["https://www.instagram.com/p/ABC123/"],
        kind: "collaborator",
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const step = events.find(e => e.kind === "step" && e.step === "interview");
    expect(step.payload).toEqual({
      questionKey: "social_collaborator_dameatlas",
      question: "You and @dameatlas put out a track together — what's the story?",
      number: 1,
      total: 3,
      sourceUrls: ["https://www.instagram.com/p/ABC123/"],
    });
    // NO excludeKeys on this path, and the exact call shape matters: the
    // exclusion set is part of the cache key, and this runs on every chat
    // turn. Passing it would make turns 2 and 3 of one sitting miss the
    // cache and re-pick their questions at temperature 0.8 — the
    // interviewer changing its mind mid-conversation. Rotation belongs to
    // getInterviewInvite, which knows about sittings.
    expect(generateGroundedQuestions).toHaveBeenCalledWith("a1", { max: 3 });
  });

  it("interview step falls back to the static bank when generation returns []", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([]);
    const { generateGroundedQuestions } = QG;
    generateGroundedQuestions.mockResolvedValueOnce([]); // e.g. no ingested posts, or Apify/Gemini had a bad day
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const step = events.find(e => e.kind === "step" && e.step === "interview");
    expect(step.payload).toEqual({
      questionKey: "sound_in_own_words",
      question: "How would you describe your sound, in your own words?",
      number: 1,
      total: 3,
      sourceUrls: [],
    });
  });

  it("a skipped grounded question is not re-asked on resume, even when regeneration returns it again", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    // Already on file: the artist skipped this grounded question earlier
    // (a row exists with answer: null) — resume must never re-offer it.
    oq.getInterviewAnswers.mockResolvedValue([
      { questionKey: "social_theme_hashtag_housemusic", answer: null },
    ]);
    const { generateGroundedQuestions } = QG;
    // Regeneration on resume yields stable keys — it returns the SAME
    // already-skipped signal again, plus a new one that hasn't been asked.
    generateGroundedQuestions.mockResolvedValueOnce([
      {
        key: "social_theme_hashtag_housemusic",
        question: "Housemusic keeps coming up — why?",
        rationale: "x",
        sourceUrls: ["https://www.instagram.com/p/OLD/"],
        kind: "theme",
      },
      {
        key: "social_standout_XYZ",
        question: "That post really struck a nerve — what inspired it?",
        rationale: "x",
        sourceUrls: ["https://www.instagram.com/p/XYZ/"],
        kind: "standout",
      },
    ]);
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    const step = events.find(e => e.kind === "step" && e.step === "interview");
    expect(step.payload.questionKey).toBe("social_standout_XYZ");
    expect(step.payload.number).toBe(2); // one question already asked (skipped counts)
  });

  it("interview step skips regeneration entirely once INTERVIEW_QUESTION_CAP distinct questions have already been asked", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([
      { questionKey: "social_collaborator_dameatlas", answer: "a" },
      { questionKey: "sound_in_own_words", answer: null },
      { questionKey: "offline_fact", answer: "b" },
    ]); // 3 distinct keys already asked — nothing left, regardless of what regeneration might return
    const { generateGroundedQuestions } = QG;
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    expect(generateGroundedQuestions).not.toHaveBeenCalled();
    expect(oq.confirmOnboardingStep).toHaveBeenCalledWith("a1", "interview");
    expect(events.some(e => e.kind === "draft")).toBe(true); // advanced straight to publish
  });

  it("interview_answer stores a grounded question's client-echoed text (no fixed bank to look it up in)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([]); // re-emission after storing still resolves fine via the default [] mock
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "social_collaborator_dameatlas",
        question: "You and @dameatlas put out a track together — what's the story?",
        answer: "It just clicked in the studio.",
      }),
    );
    expect(oq.upsertInterviewAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: "a1",
        questionKey: "social_collaborator_dameatlas",
        question: "You and @dameatlas put out a track together — what's the story?",
        answer: "It just clicked in the studio.",
        source: "onboarding",
      }),
    );
    expect(events.some(e => e.kind === "error")).toBe(false);
  });

  it("interview_answer rejects a garbage questionKey that is neither a static key nor grounded-prefixed", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "totally_made_up",
        answer: "x",
      }),
    );
    expect(oq.upsertInterviewAnswer).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(true);
  });

  // Blocker 3 (pre-demo review): gemini-2.5-flash has thinking enabled by
  // default and burns most of the 5s ack race on a one-sentence prompt.
  it("interview_answer's ack call disables Gemini thinking so the 5s race is winnable", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([]);
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "sound_in_own_words",
        answer: "Dreamy synth-pop",
      }),
    );
    expect(m.generateText).toHaveBeenCalledWith(expect.objectContaining({ thinkingBudget: 0 }));
  });

  // Blocker 3 continued: even with thinking off, a run of misses (measured
  // 4.70s/5.91s/6.85s against the 5s race) must not hand the artist the
  // same canned acknowledgement for all three interview questions.
  it("ack fallback rotates by question index — three consecutive Gemini misses never repeat the same line", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    const { runOnboardingTurn } = TH;

    const acks: string[] = [];
    for (let priorCount = 0; priorCount < 3; priorCount++) {
      // Once-only so the rejection never leaks into a later test's turn.
      m.generateText.mockRejectedValueOnce(new Error("gemini down"));
      oq.getInterviewAnswers.mockResolvedValueOnce(
        Array(priorCount).fill({ questionKey: "x", answer: "y" }),
      );
      const events = await collect(
        runOnboardingTurn("a1", {
          type: "interview_answer",
          questionKey: "sound_in_own_words",
          answer: `take ${priorCount}`,
        }),
      );
      acks.push(events.find(e => e.kind === "chat").text);
    }

    expect(new Set(acks).size).toBe(3);
  });

  // Trust-breaking defect (product owner, live testing): when an artist
  // disputed a question built from a mismatched citation, the ack replied
  // "My apologies for the confusion, I must have misremembered" — claiming
  // a memory it doesn't have and confessing to fabrication at the exact
  // moment credibility matters. Even if a model response slips past the
  // tightened prompt, the ack must never reach the artist carrying that
  // language — assert against the same blocklist the fix uses.
  const ACK_BLOCKLIST = ["misremembered", "i remember", "my apologies", "i thought", "sorry"];

  it("a disputing answer never yields an ack that claims memory or apologizes for fabrication, even if Gemini returns exactly that", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    oq.getInterviewAnswers.mockResolvedValue([]);
    m.generateText.mockResolvedValueOnce({
      text: "My apologies for the confusion, I must have misremembered.",
    });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "sound_in_own_words",
        answer:
          "the link to the post has nothing to do with what you're asking me. I actually have no idea what you're talking about",
      }),
    );
    const ack = events.find(e => e.kind === "chat").text.toLowerCase();
    for (const phrase of ACK_BLOCKLIST) expect(ack).not.toContain(phrase);
  });

  it("carries the generation-start bio through a draft and uses it instead of rereading at publish", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValue({ id: "a1", name: "Nova", bio: "Original" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "about_choice", mode: "generate", doc: "## Overview\nd" }),
    );
    const draft = events.find(e => e.kind === "draft");
    expect(draft.expectedBio).toBe("Original");
    artistQ.getArtistById.mockResolvedValue({
      id: "a1",
      name: "Nova",
      bio: "New edit in other tab",
    });
    const { persistArtistBio } = BIO;
    const { BioConflictError } = BIOCONFLICT;
    persistArtistBio.mockRejectedValue(new BioConflictError());
    await expect(
      collect(
        runOnboardingTurn("a1", {
          type: "publish",
          doc: draft.doc,
          about: draft.about,
          expectedBio: draft.expectedBio,
        }),
      ),
    ).rejects.toThrow("changed or was pinned");
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      draft.about,
      expect.objectContaining({ expectedBio: "Original" }),
    );
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "publish");
  });

  it("fails closed when a legacy draft has no starting bio snapshot", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "publish", doc: "Lore", about: "Draft" }),
    );
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "publish");
  });

  it("publish validates caps, persists doc + bio version + artists.bio, confirms publish, completes", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const dq = DQ;
    const { db } = DRIZZLE;
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "publish",
        doc: "## Overview\nd",
        about: "About text",
        expectedBio: null,
      }),
    );
    expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "About text",
      expect.objectContaining({ generated: true }),
    );
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "About text",
      expect.objectContaining({ document: { content: "## Overview\nd", sources: [] } }),
    );
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      expect.any(String),
      expect.objectContaining({ confirmSteps: ["publish"] }),
    );
    expect(events.some(e => e.kind === "complete")).toBe(true);
  });

  it("publish persists the client-echoed citation manifest, and stores the doc WITH markers but the About/bio stripped of them (public About stays clean)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const dq = DQ;
    const docService = DOC;
    docService.stripCitationMarkers.mockImplementation(text => text.replace(/\[\d+\]/g, ""));
    const { db } = DRIZZLE;
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
    const { runOnboardingTurn } = TH;
    const sources = [
      {
        id: 1,
        kind: "vault",
        label: "SoundBetter profile",
        url: "https://soundbetter.com/profiles/x",
      },
    ];
    await collect(
      runOnboardingTurn("a1", {
        type: "publish",
        expectedBio: null,
        doc: "## Overview\nCited Lauryn Hill[1].",
        about: "Cited Lauryn Hill as an influence[1].",
        sources,
      }),
    );
    expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "Cited Lauryn Hill as an influence.",
      expect.objectContaining({ generated: true }),
    );
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "Cited Lauryn Hill as an influence.",
      expect.objectContaining({
        document: { content: "## Overview\nCited Lauryn Hill[1].", sources },
      }),
    );
  });

  it("publish drops a malformed sources entry rather than persisting garbage", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const { db } = DRIZZLE;
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "publish",
        expectedBio: null,
        doc: "## Overview\nd",
        about: "About text",
        sources: [
          { id: 1, kind: "vault", label: "Real one", url: "https://x.com" },
          { id: "not-a-number", kind: "vault", label: "bad id", url: null },
          { kind: "nonsense", label: "bad kind", url: null },
          "not even an object",
        ],
      }),
    );
    const { persistArtistBio } = BIO;
    expect(persistArtistBio.mock.calls[0][2].document.sources).toEqual([
      { id: 1, kind: "vault", label: "Real one", url: "https://x.com" },
    ]);
  });

  it("publish uses atomic history-preserving persistence even when explicit history saves are capped", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const dq = DQ;
    dq.saveBioVersion.mockRejectedValue(new Error("Bio history is full"));
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Nova Reyes",
      bio: "A real hand-written bio.",
    });
    const { db } = DRIZZLE;
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "publish",
        doc: "## Overview\nd",
        about: "About text",
        expectedBio: "A real hand-written bio.",
      }),
    );
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "About text",
      expect.objectContaining({ generated: true, expectedBio: "A real hand-written bio." }),
    );
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      expect.any(String),
      expect.objectContaining({ confirmSteps: ["publish"] }),
    );
    expect(events.some(e => e.kind === "complete")).toBe(true);
  });

  it("publish delegates placeholder handling to shared persistence", async () => {
    const { ABOUT_EMPTY_STATE } = BIOCONST;
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const dq = DQ;
    const artistQ = AQ;
    artistQ.getArtistById.mockResolvedValueOnce({
      id: "a1",
      name: "Nova Reyes",
      bio: ABOUT_EMPTY_STATE,
    });
    const { db } = DRIZZLE;
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "publish",
        doc: "## Overview\nd",
        about: "About text",
        expectedBio: ABOUT_EMPTY_STATE,
      }),
    );
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    const { persistArtistBio } = BIO;
    expect(persistArtistBio).toHaveBeenCalledWith(
      "a1",
      "About text",
      expect.objectContaining({ generated: true, expectedBio: ABOUT_EMPTY_STATE }),
    );
  });

  it("publish rejects when not on the publish step", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "publish", doc: "d", about: "a" }),
    );
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
  });

  it('publish arriving after onboarding is already complete just completes — no false "not quite there" error', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: true, currentStep: null });
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "publish", doc: "d", about: "a" }),
    );
    expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
    expect(dq.saveBioVersion).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "complete")).toBe(true);
    expect(events.some(e => e.kind === "chat" && e.text.includes("not quite there"))).toBe(false);
  });

  it("fails CLOSED: a null onboarding state (query failure) yields an error and performs NO writes (C1)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue(null);
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [],
        removedSiteNames: [],
      }),
    );
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalled();
    expect(oq.upsertInterviewAnswer).not.toHaveBeenCalled();
    expect(oq.upsertArtistDoc).not.toHaveBeenCalled();
  });

  it("an out-of-step interview_answer does NOT call upsertInterviewAnswer and resyncs to the real step (I1)", async () => {
    const oq = OQ;
    // Stale card: client thinks it's on "interview", server says "vault".
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "interview_answer",
        questionKey: "sound_in_own_words",
        answer: "loud",
      }),
    );
    expect(oq.upsertInterviewAnswer).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(true);
    expect(events.some(e => e.kind === "step" && e.step === "vault")).toBe(true);
  });

  it("an out-of-step confirm_profiles does NOT write links and resyncs (I1)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "interview" });
    const { setArtistLink } = ALS;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "confirm_profiles",
        addedLinks: [{ url: "https://tiktok.com/@x" }],
        removedSiteNames: [],
      }),
    );
    expect(setArtistLink).not.toHaveBeenCalled();
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "profiles");
    expect(events.some(e => e.kind === "error")).toBe(true);
  });

  it("an out-of-step vault_review does NOT write source decisions and resyncs (I1)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const dq = DQ;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", {
        type: "vault_review",
        decisions: [{ sourceId: "s1", status: "approved" }],
        addedUrls: [],
      }),
    );
    expect(dq.updateVaultSourceStatus).not.toHaveBeenCalled();
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalledWith("a1", "vault");
    expect(events.some(e => e.kind === "error")).toBe(true);
  });

  it("vault_review leaves artist-pasted originals to durable ingestion after the approved insert", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const dq = DQ;
    dq.insertVaultSource.mockResolvedValueOnce({ id: "new-src-1" });
    const { fetchPageContent } = FPC;
    const { runOnboardingTurn } = TH;
    await collect(
      runOnboardingTurn("a1", {
        type: "vault_review",
        decisions: [],
        addedUrls: ["https://example.com/press"],
      }),
    );
    expect(dq.insertVaultSource).toHaveBeenCalledWith({
      artistId: "a1",
      url: "https://example.com/press",
      type: "article",
      status: "approved",
    });
    expect(fetchPageContent).not.toHaveBeenCalled();
    expect(dq.updateVaultSourceContent).not.toHaveBeenCalled();
  });

  it("publish skips the Gemini retry once the retry budget is exhausted, letting the failure propagate (I2)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    docService.synthesizeArtistDoc.mockRejectedValueOnce(new Error("gemini boom"));
    const dateSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0) // publishStartedAt
      .mockReturnValueOnce(31_000); // elapsed check in the catch — past PUBLISH_RETRY_BUDGET_MS (30s)
    const { runOnboardingTurn } = TH;
    await expect(collect(runOnboardingTurn("a1", { type: "open" }))).rejects.toThrow("gemini boom");
    expect(docService.synthesizeArtistDoc).toHaveBeenCalledTimes(1); // no retry attempted
    dateSpy.mockRestore();
  });

  it("the About turn skips its retry once past budget too (I2 — the branch that matters for the real worst case)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    docService.generateAboutFromDoc.mockRejectedValueOnce(new Error("about boom"));
    const dateSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0) // startedAt
      .mockReturnValueOnce(45_000); // elapsed check in the About catch — past budget
    const { runOnboardingTurn } = TH;
    // The About is written on its own turn now, after the artist approves the doc.
    await expect(
      collect(
        runOnboardingTurn("a1", {
          type: "about_choice",
          mode: "generate",
          doc: "## Overview\ndoc",
        }),
      ),
    ).rejects.toThrow("about boom");
    expect(docService.generateAboutFromDoc).toHaveBeenCalledTimes(1); // no retry attempted
    dateSpy.mockRestore();
  });

  // The reorder itself: read and correct the record, THEN decide about the About.
  it('about_choice mode "generate" writes the About from the doc the artist echoed back, corrections included', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    docService.generateAboutFromDoc.mockResolvedValueOnce("An About.");
    const { runOnboardingTurn } = TH;
    const corrected = "## Overview\nThe artist corrected this line themselves.";
    const events = await collect(
      runOnboardingTurn("a1", { type: "about_choice", mode: "generate", doc: corrected }),
    );
    expect(docService.generateAboutFromDoc).toHaveBeenCalledWith(
      expect.any(String),
      corrected,
      expect.anything(),
    );
    const draft = events.find(e => e.kind === "draft");
    expect(draft.stage).toBe("about");
    expect(draft.doc).toBe(corrected);
    expect(draft.about).toBe("An About.");
  });

  it('about_choice mode "self" generates nothing and hands back an empty About to write into', async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "about_choice", mode: "self", doc: "## Overview\ndoc" }),
    );
    // Their words are the point — we must not put a draft in their mouth first.
    expect(docService.generateAboutFromDoc).not.toHaveBeenCalled();
    const draft = events.find(e => e.kind === "draft");
    expect(draft.stage).toBe("about");
    expect(draft.about).toBe("");
    expect(draft.selfWrite).toBe(true);
  });

  it("about_choice refuses to run before the earlier steps are done", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const docService = DOC;
    const { runOnboardingTurn } = TH;
    const events = await collect(
      runOnboardingTurn("a1", { type: "about_choice", mode: "generate", doc: "## Overview\ndoc" }),
    );
    expect(docService.generateAboutFromDoc).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(true);
  });

  it("publish retries the Gemini call once when still within the retry budget (I2 regression)", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    docService.synthesizeArtistDoc
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("## Overview\nrecovered doc");
    const dateSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0) // publishStartedAt
      .mockReturnValueOnce(5_000); // elapsed check in the catch — well within budget
    const { runOnboardingTurn } = TH;
    const events = await collect(runOnboardingTurn("a1", { type: "open" }));
    expect(docService.synthesizeArtistDoc).toHaveBeenCalledTimes(2); // retried once
    expect(events.some(e => e.kind === "draft")).toBe(true);
    dateSpy.mockRestore();
  });

  // Discovery is bounded (DISCOVERY_BUDGET_MS, checked between tiers), so a slow run
  // silently drops its later tiers and the same artist sees six profiles one time and
  // two the next. "Look for more" re-runs the search with a fresh budget.
  it("find_more_profiles re-runs discovery and hands back a fresh profiles card", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { discoverArtistProfilesStream } = PD;
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "find_more_profiles" }));

    expect(discoverArtistProfilesStream).toHaveBeenCalledWith("a1");
    expect(events.find(e => e.kind === "step")?.step).toBe("profiles");
  });

  it("find_more_profiles SAVES the artist's decisions before re-searching, without advancing", async () => {
    // The leak a real artist hit: re-searching sent no payload, so his four
    // confirmed profiles were discarded and came back as unconfirmed
    // candidates. The card's own copy promises "leaving a card as-is
    // confirms it" — re-searching has to honour that too.
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "profiles" });
    const { extractArtistId } = SVC;
    extractArtistId.mockResolvedValueOnce({ siteName: "tiktok", id: "nova" });
    const { setArtistLink, clearArtistLink } = ALS;
    setArtistLink.mockClear();
    clearArtistLink.mockClear();
    const { runOnboardingTurn } = TH;

    const events = await collect(
      runOnboardingTurn("a1", {
        type: "find_more_profiles",
        addedLinks: [{ url: "https://tiktok.com/@nova" }],
        removedSiteNames: ["facebook"],
      }),
    );

    expect(setArtistLink).toHaveBeenCalledWith("a1", "tiktok", "nova");
    expect(clearArtistLink).toHaveBeenCalledWith("a1", "facebook");
    // Re-searching is not confirming: the step must NOT advance.
    expect(oq.confirmOnboardingStep).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(false);
  });

  it("find_more_profiles refuses once the artist has moved past the profiles step", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "vault" });
    const { discoverArtistProfilesStream } = PD;
    const { runOnboardingTurn } = TH;

    const events = await collect(runOnboardingTurn("a1", { type: "find_more_profiles" }));

    expect(discoverArtistProfilesStream).not.toHaveBeenCalled();
    expect(events.some(e => e.kind === "error")).toBe(true);
  });

  // Every other step narrates first, then shows its card. The publish step did the
  // reverse: the client anchors the artist to the top of a new card, then the trailing
  // narration line arrived and pulled them straight past the (very tall) document to
  // the bottom of it. Order is the fix — the card is the last thing in the turn.
  it("narrates before the card in every draft stage, never after", async () => {
    const oq = OQ;
    oq.getOnboardingState.mockResolvedValue({ complete: false, currentStep: "publish" });
    const docService = DOC;
    docService.synthesizeArtistDoc.mockResolvedValue("## Overview\nA doc.");
    docService.generateAboutFromDoc.mockResolvedValue("An About.");
    const { runOnboardingTurn } = TH;

    const expectNarrationBeforeCard = (events: any, label: any) => {
      const draftIdx = events.findIndex((e: any) => e.kind === "draft");
      expect(draftIdx).toBeGreaterThan(-1);
      // something was said before the card appeared...
      expect(events.slice(0, draftIdx).some((e: any) => e.kind === "chat")).toBe(true);
      // ...and nothing is said after it, which is what yanked the scroll position
      expect({
        label,
        trailing: events.slice(draftIdx + 1).filter((e: any) => e.kind === "chat"),
      }).toEqual({ label, trailing: [] });
    };

    expectNarrationBeforeCard(await collect(runOnboardingTurn("a1", { type: "open" })), "doc");
    expectNarrationBeforeCard(
      await collect(
        runOnboardingTurn("a1", { type: "about_choice", mode: "generate", doc: "## Overview\nd" }),
      ),
      "about",
    );
    expectNarrationBeforeCard(
      await collect(
        runOnboardingTurn("a1", { type: "about_choice", mode: "self", doc: "## Overview\nd" }),
      ),
      "self-write",
    );
  });
});
