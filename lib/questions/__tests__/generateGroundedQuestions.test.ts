import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SocialPostRow } from "@/lib/instagram/types";
import { post } from "@/lib/socialSignals/__tests__/post";
import { EXTRACTION, credit } from "@/lib/questions/__tests__/extraction";

const m = vi.hoisted(() => ({
  getArtistById: vi.fn(),
  getSocialPostsOrNull: vi.fn(),
  getSocialCredits: vi.fn(),
  generateArray: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.getArtistById }));
vi.mock("@/lib/instagram/getSocialPostsOrNull", () => ({
  getSocialPostsOrNull: m.getSocialPostsOrNull,
}));
vi.mock("@/lib/credits/getSocialCredits", () => ({ getSocialCredits: m.getSocialCredits }));
vi.mock("@/lib/ai/generateArray", () => ({ generateArray: m.generateArray }));
const { generateGroundedQuestions } = await import("@/lib/questions/generateGroundedQuestions");

const OWN_POSTS: SocialPostRow[] = [
  post({
    caption: "house been therapy",
    url: "https://www.instagram.com/p/OWN1/",
    postedAt: "2026-05-01T00:00:00.000Z",
    likeCount: 500,
    playCount: 9000,
    hashtags: ["housemusic"],
    musicTitle: "Signals",
    musicArtist: "Brian Eno",
  }),
  post({
    caption: "house is a church",
    url: "https://www.instagram.com/p/OWN1B/",
    postedAt: "2026-05-03T00:00:00.000Z",
    likeCount: 30,
    playCount: 300,
    hashtags: ["housemusic"],
  }),
  ...Array.from({ length: 5 }, (_, i) =>
    post({
      caption: null,
      url: `https://www.instagram.com/p/OWNREG${i}/`,
      postedAt: `2026-0${i + 1}-01T00:00:00.000Z`,
      likeCount: 20 + i,
      playCount: 100 + i,
    }),
  ),
  post({
    ownerUsername: "dameatlas",
    isOwnPost: false,
    caption: "collab drop with pete",
    url: "https://www.instagram.com/p/COLLAB1/",
    postedAt: "2026-05-02T00:00:00.000Z",
    likeCount: 100,
    playCount: 2000,
    musicTitle: "crying on the floor",
    musicArtist: "Dame Atlas, Pete Rango",
  }),
];

type Req = { instructions?: string; prompt?: string };
const isVerifier = (req: Req) =>
  String(req?.instructions ?? "").startsWith("You are fact-checking");
const signalsIn = (req: Req) =>
  JSON.parse(String(req.prompt).split("SIGNALS:\n")[1].split("\n\nChoose")[0]) as {
    signalId: string;
    kind: string;
    authoredBy: string;
    material: string;
  }[];
const approveAll = (req: Req) => {
  const n = (String(req.prompt).match(/--- QUESTION \d+ ---/g) ?? []).length;
  return {
    output: Array.from({ length: n }, (_, i) => ({
      i,
      ok: true,
      contentSpecific: true,
      problem: "",
    })),
  };
};
/** Answers generation with `answers`, the checker by approving everything. */
const reply = (answers: unknown[]) =>
  m.generateArray.mockImplementation(async (req: Req) =>
    isVerifier(req) ? approveAll(req) : { output: answers },
  );
const generationPrompt = () => m.generateArray.mock.calls.find(c => !isVerifier(c[0]))![0] as Req;

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.getArtistById.mockResolvedValue({ id: "a1", name: "Pete Rango", instagram: "p3t3rango" });
  m.getSocialPostsOrNull.mockResolvedValue(OWN_POSTS);
  m.getSocialCredits.mockResolvedValue({ credits: [], statements: [] });
  reply([]);
});

describe("generateGroundedQuestions", () => {
  it("returns [] for a missing artist, no posts, a failed post read, or max 0", async () => {
    m.getArtistById.mockResolvedValueOnce(undefined);
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    m.getSocialPostsOrNull.mockResolvedValueOnce([]);
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    m.getSocialPostsOrNull.mockResolvedValueOnce(null);
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    expect(await generateGroundedQuestions("a1", { max: 0 })).toEqual([]);
    expect(m.generateArray).not.toHaveBeenCalled();
  });

  it("builds questions from model answers, joined back to OUR signal data", async () => {
    reply([
      {
        signalId: "collab_dameatlas",
        question: "You and @dameatlas dropped a track together — who pushed back?",
        rationale: "real collab",
      },
      {
        signalId: "theme_hashtag_housemusic",
        question: "House keeps coming up — who played it to you first?",
        rationale: "recurring hashtag",
      },
    ]);
    const questions = await generateGroundedQuestions("a1");
    expect(questions).toHaveLength(2);
    const collab = questions.find(q => q.kind === "collaborator")!;
    expect(collab.key).toBe("social_collaborator_dameatlas");
    expect(collab.sourceUrls).toEqual(["https://www.instagram.com/p/COLLAB1/"]);
    const theme = questions.find(q => q.kind === "theme")!;
    expect(theme.key).toBe("social_theme_hashtag_housemusic");
    expect([...theme.sourceUrls].sort()).toEqual([
      "https://www.instagram.com/p/OWN1/",
      "https://www.instagram.com/p/OWN1B/",
    ]);
  });

  it("drops an answer whose signalId we never supplied, and duplicates after the first", async () => {
    reply([
      {
        signalId: "made_up_signal_not_real",
        question: "Tell me about this thing I invented",
        rationale: "x",
      },
      { signalId: "collab_dameatlas", question: "First question", rationale: "x" },
      { signalId: "collab_dameatlas", question: "Second question", rationale: "x" },
    ]);
    const questions = await generateGroundedQuestions("a1");
    expect(questions.map(q => q.question)).toEqual(["First question"]);
  });

  it("caps output at max", async () => {
    reply([
      { signalId: "collab_dameatlas", question: "q1", rationale: "x" },
      { signalId: "theme_hashtag_housemusic", question: "q2", rationale: "x" },
    ]);
    expect(await generateGroundedQuestions("a1", { max: 1 })).toHaveLength(1);
  });

  it("never throws: [] when the model throws or the artist read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.generateArray.mockImplementation(async () => {
      throw new Error("AI_GATEWAY_API_KEY must be set");
    });
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    m.getArtistById.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    error.mockRestore();
  });

  it("labels a collab-owned signal @handle, and keeps the model ungrounded with the verbatim prompt", async () => {
    await generateGroundedQuestions("a1");
    const call = generationPrompt();
    const payload = signalsIn(call);
    expect(payload.find(c => c.signalId === "collab_dameatlas")!.authoredBy).toBe("@dameatlas");
    expect(payload.find(c => c.signalId === "theme_hashtag_housemusic")!.authoredBy).toBe("artist");
    const music = payload.find(c => c.signalId.startsWith("music_crying"))!;
    expect(music.authoredBy).toBe("@dameatlas");
    expect(music.material).toContain("NOT");
    expect(call.instructions).toContain("NEVER say or imply");
    expect(call).toMatchObject({ temperature: 0.8 });
    expect(call.prompt).toContain("Choose at most");
  });

  it("offers relationships from the stored credits", async () => {
    m.getSocialCredits.mockResolvedValue(EXTRACTION);
    await generateGroundedQuestions("a1");
    const prompt = String(generationPrompt().prompt);
    expect(prompt).toContain("partnership_p3t3rango");
    expect(prompt).toContain("same_post_B");
    expect(prompt).not.toContain("same_post_Z");
  });

  it("drops a question the checker rejects, or leaves without a verdict", async () => {
    m.getSocialCredits.mockResolvedValue(EXTRACTION);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    m.generateArray.mockImplementation(async (req: Req) =>
      isVerifier(req)
        ? { output: [{ i: 0, ok: false, problem: "introduction to samplers" }] }
        : {
            output: [
              { signalId: "same_post_B", question: "q", rationale: "x" },
              { signalId: "credit_p3t3rango", question: "q2", rationale: "x" },
            ],
          },
    );
    expect(await generateGroundedQuestions("a1")).toEqual([]);
    log.mockRestore();
  });

  it("recovers the yield the fact-checker used to eat, and returns no more than asked", async () => {
    let asked = 0;
    m.generateArray.mockImplementation(async (req: Req) => {
      if (isVerifier(req)) {
        const n = (String(req.prompt).match(/--- QUESTION \d+ ---/g) ?? []).length;
        return { output: Array.from({ length: n }, (_, i) => ({ i, ok: i % 3 === 0 })) };
      }
      asked = Number(String(req.prompt).match(/at most (\d+)/)?.[1] ?? 0);
      return {
        output: signalsIn(req).map((sig, i) => ({
          signalId: sig.signalId,
          question: `Q${i}?`,
          rationale: "r",
        })),
      };
    });
    m.getSocialCredits.mockResolvedValue(EXTRACTION);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const out = await generateGroundedQuestions("a1", { max: 3 });
    expect(asked).toBeGreaterThan(3);
    expect(out.length).toBeGreaterThan(1);
    expect(out.length).toBeLessThanOrEqual(3);
    log.mockRestore();
  });

  it("ranks the clean question first and keeps flagged ones behind it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    m.generateArray.mockImplementation(async (req: Req) =>
      isVerifier(req)
        ? approveAll(req)
        : {
            output: signalsIn(req).map((sig, i) => ({
              signalId: sig.signalId,
              question:
                i === 0
                  ? "Who pushed back on that?"
                  : `Across ${i + 4} posts you did things; what changed?`,
              rationale: "r",
            })),
          },
    );
    const out = await generateGroundedQuestions("a1", { max: 3 });
    expect(out[0].question).toBe("Who pushed back on that?");
    expect(out.length).toBeGreaterThan(1);
    log.mockRestore();
  });

  it("caps questions about other people at half the set", async () => {
    m.getSocialCredits.mockResolvedValue({
      credits: ["alan", "cherele", "oyabun"].flatMap(h => [
        credit(h, `https://www.instagram.com/p/${h}1/`, "production partner"),
        credit(h, `https://www.instagram.com/p/${h}2/`, "production partner"),
      ]),
      statements: [
        {
          quote: "the pandemic was a blessing and a curse",
          topic: "the pandemic",
          url: "https://www.instagram.com/p/S1/",
          postedAt: null,
        },
        {
          quote: "house has been therapy for me",
          topic: "house music",
          url: "https://www.instagram.com/p/S2/",
          postedAt: null,
        },
      ],
    });
    const people = ["partnership", "same_post", "credit", "collaborator"];
    m.generateArray.mockImplementation(async (req: Req) => {
      if (isVerifier(req)) return approveAll(req);
      const ranked = [...signalsIn(req)].sort(
        (a, b) => (people.includes(a.kind) ? 0 : 1) - (people.includes(b.kind) ? 0 : 1),
      );
      return {
        output: ranked.map((sig, i) => ({
          signalId: sig.signalId,
          question: `Who pushed back on that, ${i}?`,
          rationale: "r",
        })),
      };
    });
    const out = await generateGroundedQuestions("a1", { max: 4 });
    expect(out.some(q => !people.includes(q.kind))).toBe(true);
    expect(out.filter(q => people.includes(q.kind)).length).toBeLessThanOrEqual(2);
  });

  it("warns when max outgrows the draft ceiling, and never asks for more than there are signals", async () => {
    // Enough signals that the draft ceiling, not the pool, is what binds.
    m.getSocialCredits.mockResolvedValue(EXTRACTION);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let asked = 0;
    let available = 0;
    m.generateArray.mockImplementation(async (req: Req) => {
      if (isVerifier(req)) return approveAll(req);
      asked = Number(String(req.prompt).match(/at most (\d+)/)?.[1] ?? 0);
      available = signalsIn(req).length;
      return { output: [] };
    });
    await generateGroundedQuestions("a1", { max: 6 });
    expect(warn.mock.calls.flat().join(" ")).toMatch(/Oversampling degraded/);
    warn.mockClear();
    await generateGroundedQuestions("a1", { max: 50 });
    expect(asked).toBeLessThanOrEqual(available);
    warn.mockClear();
    await generateGroundedQuestions("a1", { max: 3 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("asks the model afresh on every call: there is no in-process cache", async () => {
    await generateGroundedQuestions("a1", { max: 3 });
    await generateGroundedQuestions("a1", { max: 3 });
    expect(m.generateArray.mock.calls.filter(c => !isVerifier(c[0]))).toHaveLength(2);
  });
});
