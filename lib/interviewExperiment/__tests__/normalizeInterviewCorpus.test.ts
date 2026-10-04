import { describe, expect, it } from "vitest";
import { normalizeInterviewCorpus } from "@/lib/interviewExperiment/normalizeInterviewCorpus";
const rows = {
  artist: { id: "a", name: "Artist", instagram: "artist" },
  posts: [],
  sources: [],
  answers: [],
  corrections: [],
  credits: [],
};
const post = {
  id: "p",
  artist_id: "a",
  platform: "instagram",
  platform_post_id: "P",
  owner_username: "artist",
  is_own_post: true,
  url: "https://www.instagram.com/p/P/",
  caption: "I recorded in a stairwell",
  posted_at: "2024-01-01",
  created_at: "2024-01-02",
  raw: null,
};
describe("normalizeInterviewCorpus", () => {
  it("excludes other artists, non-owner captions, and unapproved Lore", () => {
    const result = normalizeInterviewCorpus(
      {
        ...rows,
        posts: [
          post,
          { ...post, id: "other", artist_id: "b" },
          { ...post, id: "guest", is_own_post: false },
        ],
        sources: [{ id: "s", artist_id: "a", status: "pending", extracted_text: "unapproved" }],
      } as any,
      "2026-10-04",
    );
    expect(result.evidence.map(e => e.id)).toEqual(["post:p"]);
  });
  it("preserves trusted reel text as unverified speech with its own availability date", () => {
    const raw = {
      _musicnerdTranscript: {
        version: 1,
        actor: "apify/instagram-reel-scraper",
        runId: "run",
        fetchedAt: "2026-01-01",
        text: "I recorded vocals yesterday.",
      },
    };
    const result = normalizeInterviewCorpus(
      { ...rows, posts: [{ ...post, raw }] } as any,
      "2026-10-04",
    );
    expect(result.evidence.find(e => e.kind === "transcript")).toMatchObject({
      attribution: "speaker unverified",
      availableAt: "2026-01-01T00:00:00.000Z",
      url: post.url,
    });
    expect(
      normalizeInterviewCorpus(
        { ...rows, posts: [{ ...post, raw: { transcript: "not provenance" } }] } as any,
        "2026-10-04",
      ).evidence,
    ).toHaveLength(1);
  });
  it("retains original answers and corrections without treating questions as artist statements", () => {
    const result = normalizeInterviewCorpus(
      {
        ...rows,
        answers: [
          {
            id: "a1",
            artist_id: "a",
            question: "Why that room?",
            answer: "The room had a short echo.",
            created_at: "2026-01-02",
          },
        ],
        corrections: [
          {
            id: "c",
            artist_id: "a",
            claim: "alone",
            correction: "with my band",
            kind: "fix",
            created_at: "2026-01-03",
            updated_at: "2026-01-04",
          },
        ],
      } as any,
      "2026-10-04",
    );
    expect(result.evidence.map(e => e.text).join("\n")).toContain(
      "ANSWER (artist's words): The room had a short echo.",
    );
    expect(result.evidence.find(e => e.kind === "correction")?.availableAt).toBe("2026-01-04");
  });
});
