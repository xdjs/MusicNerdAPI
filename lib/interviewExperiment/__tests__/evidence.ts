import type { InterviewCorpus, InterviewEvidence } from "@/lib/interviewExperiment/types";
export const evidence = (overrides: Partial<InterviewEvidence> = {}): InterviewEvidence => ({
  id: "p1",
  group: "https://example.com/post/1",
  kind: "post",
  text: "I recorded drums alone in a stairwell.",
  url: "https://example.com/post/1",
  attribution: "artist",
  publishedAt: "2024-01-01",
  availableAt: "2024-01-02",
  ...overrides,
});
export const corpus = (items: InterviewEvidence[] = [evidence()]): InterviewCorpus => ({
  version: 1,
  capturedAt: "2026-10-04T00:00:00Z",
  artist: { id: "artist-1", name: "Test artist", instagram: "artist" },
  evidence: items,
  baseline: { posts: [], extraction: { credits: [], statements: [] } },
});
