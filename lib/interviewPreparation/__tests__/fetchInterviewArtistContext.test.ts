import { it, expect, vi } from "vitest";
import { fetchInterviewArtistContext } from "../fetchInterviewArtistContext";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { rawKnowledge, vault, social, artistId } from "@/lib/knowledge/__tests__/fixtures";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/knowledge/loadArtistKnowledge", () => ({ loadArtistKnowledge: load }));
it("keeps biography and transcript originals when recent social posts dominate", async () => {
  const snapshot = normalizeArtistKnowledge({
    ...rawKnowledge,
    vault: [{ ...vault, extractedText: "Older interview. ".repeat(400) }],
    social: Array.from({ length: 20 }, (_, i) => ({
      ...social,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    })),
  });
  load.mockResolvedValue(snapshot);
  const result = await fetchInterviewArtistContext({ artistId, userId: artistId });
  expect(result.originals).toHaveLength(9);
  expect(new Set(result.originals.map(p => p.passage.source.kind))).toEqual(
    new Set(["vault", "social_caption", "reel_transcript"]),
  );
  expect(result.originals.every(p => p.returnedChars <= 2400)).toBe(true);
  expect(result.originals.find(p => p.passage.source.kind === "vault")?.truncated).toBe(true);
  expect(result.brief.summaryIsEvidence).toBe(false);
  expect(result.coverage.totalSources).toBeGreaterThan(result.coverage.openedSources);
  expect(load).toHaveBeenCalledWith(artistId, artistId);
});
it("expands repeat interview context with distinct saved originals only", async () => {
  const snapshot = normalizeArtistKnowledge({
    ...rawKnowledge,
    social: Array.from({ length: 20 }, (_, i) => ({
      ...social,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    })),
  });
  const first = await fetchInterviewArtistContext({ artistId, userId: artistId }, snapshot);
  const ids = new Set(first.originals.map(p => p.passage.source.sourceId));
  const second = await fetchInterviewArtistContext({ artistId, userId: artistId }, snapshot, ids);
  expect(second.originals.length).toBeGreaterThan(0);
  expect(second.originals.every(p => !ids.has(p.passage.source.sourceId))).toBe(true);
  expect(second.originals.every(p => p.returnedChars <= 2400)).toBe(true);
});
