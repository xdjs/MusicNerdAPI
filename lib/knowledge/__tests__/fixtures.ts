import type { RawKnowledge } from "@/lib/knowledge/types";

export const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const vault: RawKnowledge["vault"][number] = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  artistId,
  status: "approved",
  origin: "manual",
  type: "website",
  filePath: null,
  url: "https://example.org/interview",
  title: "Keep Graph changes everything",
  snippet: "A graph memory breakthrough",
  extractedText: "The architecture keeps attention. No graph framework is proposed.",
  publishedAt: "2023-05-19",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: null,
};
export const social: RawKnowledge["social"][number] = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  artistId,
  platform: "instagram",
  ownerUsername: "fixtureartist",
  isOwnPost: true,
  caption: "A new record",
  url: "https://www.instagram.com/reel/example/",
  postedAt: "2026-10-01T00:00:00Z",
  isRepost: false,
  isRetweet: false,
  transcript: {
    version: 1,
    actor: "apify/instagram-reel-scraper",
    text: "Someone says: I sampled that record.",
    fetchedAt: "2026-10-02T00:00:00Z",
    runId: "private-run",
    other: "provider-secret",
  },
};
export const answer: RawKnowledge["answers"][number] = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  artistId,
  questionKey: "recording",
  question: "How did you record the demo?",
  answer: "At home, but not alone.",
  source: "interview",
  sitting: 1,
  offeredAt: "2026-10-01T00:00:00Z",
  createdAt: "2026-10-02T00:00:00Z",
};
export const correction: RawKnowledge["corrections"][number] = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  artistId,
  claim: "A solo recording",
  correction: "My drummer was there.",
  kind: "correction",
};
export const rawKnowledge: RawKnowledge = {
  artist: { id: artistId, name: "Fixture Artist", bio: null },
  summary: null,
  vault: [],
  social: [],
  answers: [],
  corrections: [],
  jobs: [],
};
