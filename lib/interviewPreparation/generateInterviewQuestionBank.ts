import { checkSpokenInterviewBank } from "./checkSpokenInterviewBank";
import { fetchPreviouslyCitedInterviewSources } from "./fetchPreviouslyCitedInterviewSources";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { fetchMandatoryInterviewMemory } from "./fetchMandatoryInterviewMemory";
import { fetchInterviewQuestionIndex } from "./fetchInterviewQuestionIndex";
import { fetchInterviewArtistContext } from "./fetchInterviewArtistContext";
import { prepareArtistQuestion } from "./prepareArtistQuestion";
import { generateApiInterviewQuestion } from "./generateApiInterviewQuestion";
import { checkpointInterviewStage } from "./checkpointInterviewStage";
import type { KnowledgeToolConfig } from "./types";
import type { StageCache, PreparedCandidate } from "./preparationTypes";
/** Prepare and independently check a complete sitting before exposing its first question. */
export async function generateInterviewQuestionBank(
  config: KnowledgeToolConfig,
  sitting: number,
  count: number,
  signal: AbortSignal,
  cache: StageCache,
  invocation: Parameters<typeof generateApiInterviewQuestion>[7] = {},
) {
  invocation.memory ??= await fetchMandatoryInterviewMemory(config, sitting, signal);
  invocation.previousQuestions ??= await fetchInterviewQuestionIndex(config, signal);
  invocation.artistSnapshot ??= await loadArtistKnowledge(config.artistId, config.userId);
  invocation.previouslyCitedSourceIds ??= await fetchPreviouslyCitedInterviewSources(config);
  const baseQuestions = invocation.previousQuestions;
  const artistContext = await fetchInterviewArtistContext(
    config,
    invocation.artistSnapshot,
    new Set(),
    invocation.previouslyCitedSourceIds,
  );
  let draft = await checkpointInterviewStage(cache, "bankDraft", async () =>
    prepareArtistQuestion(invocation.memory!, baseQuestions, signal, artistContext, count),
  );
  if (!draft && artistContext.coverage.totalSources > artistContext.originals.length) {
    // A narrow first window can exhaust familiar topics in repeat sittings.
    // Try a different bounded set of saved originals as one batch before tool research.
    draft = await checkpointInterviewStage(cache, "bankDraft:expanded", async () => {
      const expanded = await fetchInterviewArtistContext(
        config,
        invocation.artistSnapshot,
        new Set(artistContext.originals.map(original => original.passage.source.sourceId)),
      );
      if (!expanded.originals.length) return null;
      return prepareArtistQuestion(invocation.memory!, baseQuestions, signal, expanded, count);
    });
  }
  const checked = draft
    ? await checkpointInterviewStage(cache, "bankChecks", () =>
        checkSpokenInterviewBank(draft!, invocation.memory!, baseQuestions, signal),
      )
    : undefined;
  const ready = (cache.bankReady ??= []) as PreparedCandidate[];
  for (let index = ready.length; index < count; index++) {
    const child = (cache[`bankQuestion:${index}`] ??= {}) as StageCache;
    if (draft?.candidates[index] && !child.context_question)
      child.context_question = {
        candidate: draft.candidates[index],
        originals: draft.originals,
        usage: index === 0 ? draft.usage : { inputTokens: 0, outputTokens: 0 },
      };
    if (checked && !child["spoken_check:0"])
      child["spoken_check:0"] = {
        output: checked.checks[index],
        usage: index === 0 ? checked.usage : { inputTokens: 0, outputTokens: 0 },
      };
    const reserved = (draft?.candidates ?? []).filter((_, i) => i > index);
    const prior = [
      ...baseQuestions,
      ...[...ready, ...reserved].map((candidate, i) => ({
        entryId: `prepared:${i}`,
        revision: "0".repeat(64),
        questionKey: `prepared:${i}`,
        answerState: "offered",
        sitting,
        question: candidate.question,
      })),
    ];
    const candidate = await generateApiInterviewQuestion(
      config,
      sitting,
      signal,
      undefined,
      undefined,
      undefined,
      child,
      { ...invocation, previousQuestions: prior },
    );
    ready.push(candidate);
  }
  return ready;
}
