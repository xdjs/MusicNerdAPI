import { z } from "zod";
import { generateArray } from "@/lib/ai/generateArray";
import { getArtistById } from "@/lib/artists/getArtistById";
import { withTimeout } from "@/lib/async/withTimeout";
import { getSocialCredits } from "@/lib/credits/getSocialCredits";
import { getSocialPostsOrNull } from "@/lib/instagram/getSocialPostsOrNull";
import { buildCandidates } from "@/lib/questions/buildCandidates";
import { reelAudioCandidates } from "@/lib/questions/reelAudioCandidates";
import { capPersonQuestions } from "@/lib/questions/capPersonQuestions";
import {
  DEFAULT_MAX_QUESTIONS,
  DRAFT_OVERSAMPLE,
  GENERATION_TIMEOUT_MS,
  MAX_DRAFTS,
} from "@/lib/questions/const";
import { diversify } from "@/lib/questions/diversify";
import { keepOnlySupported } from "@/lib/questions/keepOnlySupported";
import { questionSystemInstruction } from "@/lib/questions/questionSystemInstruction";
import { resolveAnswers } from "@/lib/questions/resolveAnswers";
import { selectDrafts } from "@/lib/questions/selectDrafts";
import type { GroundedQuestion } from "@/lib/questions/types";
import { deriveSocialSignals } from "@/lib/socialSignals/deriveSocialSignals";

/**
 * Interview questions grounded in the artist's own posts and caption credits.
 * The model only phrases a question for a signalId we supplied; the key,
 * source urls and kind always come from our signal. Drafts are oversampled,
 * fact-checked, cleaned of boilerplate, capped at half about other people and
 * spread across kinds.
 *
 * MusicNerdWeb caches the result in its own process for 15 minutes; this API
 * doesn't, so each call asks the model afresh. The chat asks once per step.
 *
 * @param artistId - The artist.
 * @param opts - Options.
 * @param opts.max - How many questions (default 6; the onboarding chat asks for 3).
 * @returns Up to `max` questions; [] on any failure, so the interview falls back to its static questions.
 */
export async function generateGroundedQuestions(
  artistId: string,
  opts?: { max?: number },
): Promise<GroundedQuestion[]> {
  const max = Math.max(0, opts?.max ?? DEFAULT_MAX_QUESTIONS);
  if (!artistId || max === 0) return [];

  try {
    const artist = await getArtistById(artistId);
    if (!artist) return [];
    const artistName = artist.name ?? "the artist";

    const posts = (await getSocialPostsOrNull(artistId)) ?? [];
    if (posts.length === 0) return [];

    const signals = deriveSocialSignals(posts, artist.instagram ?? "", artistName);
    const extraction = await getSocialCredits(artistId);
    const candidates = [
      ...reelAudioCandidates(posts, artistName),
      ...buildCandidates(signals, artistName, extraction),
    ];
    if (candidates.length === 0) return [];

    const wantedDrafts = max * DRAFT_OVERSAMPLE;
    const draftTarget = Math.min(wantedDrafts, MAX_DRAFTS, candidates.length);
    if (draftTarget < wantedDrafts && draftTarget < candidates.length) {
      console.warn(
        `[questionGenerator] Oversampling degraded: wanted ${wantedDrafts} drafts for ${max} question(s), capped at ${draftTarget} by the latency ceiling — expect generic fallbacks to fill the gap.`,
      );
    }

    const byId = new Map(candidates.map(c => [c.signalId, c]));
    const promptPayload = candidates.map(({ signalId, kind, authoredBy, material }) => ({
      signalId,
      kind,
      authoredBy,
      material,
    }));
    const response = await withTimeout(
      generateArray({
        prompt: `SIGNALS:\n${JSON.stringify(promptPayload, null, 2)}\n\nChoose at most ${draftTarget} of the most interesting, distinct signals and write one question each, BEST FIRST. Fewer than ${draftTarget} is fine — even zero — if the rest don't clear the bar.`,
        instructions: questionSystemInstruction(artistName),
        // Stability comes from persisting the asked questions; 0.2 only flattened the writing.
        temperature: 0.8,
        thinkingBudget: 1024,
        element: z.object({
          signalId: z.string().optional(),
          question: z.string().optional(),
          rationale: z.string().optional(),
        }),
      }),
      GENERATION_TIMEOUT_MS,
      "questionGenerator timeout",
    );

    const drafted = selectDrafts(resolveAnswers(response.output, byId), draftTarget);
    const demoted = new Map(drafted.filter(d => d.demotedFor).map(d => [d.key, d.demotedFor!]));
    const verified = await keepOnlySupported(drafted, artistName);
    // Clean before flagged: this split, not the draft order, is what ranks them.
    const clean = verified.filter(q => !demoted.has(q.key));
    const flagged = verified.filter(q => demoted.has(q.key));
    const questions = diversify(capPersonQuestions([...clean, ...flagged], max), max);
    for (const q of questions) {
      const why = demoted.get(q.key);
      if (why)
        console.log(
          `[questionGenerator] using a question that ${why} — better than a generic fallback: ${q.question.slice(0, 70)}`,
        );
    }
    return questions;
  } catch (e) {
    console.error("[generateGroundedQuestions] Error:", e);
    return [];
  }
}
