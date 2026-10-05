import { buildInterviewArchive } from "./buildInterviewArchive";
import { validateInterviewResearch } from "./validateInterviewResearch";
import { openInterviewContext } from "./openInterviewContext";
import { prepareInterviewCitations } from "./prepareInterviewCitations";
import { selectInterviewEvidence } from "./selectInterviewEvidence";
import { validatePreparedInterviewDraft } from "./validatePreparedInterviewDraft";
import { callInterviewModel } from "./callInterviewModel";
import {
  GROUNDED_MODEL,
  GROUNDED_REVIEW_MODEL,
  GROUNDED_REVIEW_INSTRUCTION,
  GROUNDED_DRAFT_SCHEMA,
  GROUNDED_VERDICT_SCHEMA,
  GROUNDED_WRITER_INSTRUCTION,
} from "./groundedConst";
import type { ExperimentResult, InterviewCorpus, InterviewDraft, InterviewEvidence } from "./types";

/** Draft from reusable complete preparation, then repair failed questions once against originals.
 * @param corpus - Frozen source archive; no live changes.
 * @param options - Bound research and assignment; latest conversation is passed verbatim to each call.
 * @returns Only rechecked questions, with every rejected attempt and actual model usage preserved.
 */
export async function runGroundedInterview(
  corpus: InterviewCorpus,
  options: {
    purpose: string;
    research: unknown;
    model?: string;
    reviewModel?: string;
    asOf?: string;
    conversation?: unknown;
  },
): Promise<ExperimentResult> {
  const research = validateInterviewResearch(corpus, options.research, options);
  const archive = buildInterviewArchive(corpus, options);
  const model = options.model ?? GROUNDED_MODEL;
  const reviewModel = options.reviewModel ?? GROUNDED_REVIEW_MODEL;
  const conversationEvidence: InterviewEvidence[] = (archive.conversation?.turns ?? [])
    .filter(t => t.speaker === "artist")
    .map((t, i) => ({
      id: `conversation:${i}`,
      group: "private-replay",
      kind: "answer",
      text: t.text,
      title: `${archive.conversation!.kind} replay — not a newly received answer`,
      url: null,
      attribution: "artist",
      publishedAt: null,
      availableAt: archive.asOf,
    }));
  if (archive.evidence.some(e => conversationEvidence.some(t => t.id === e.id)))
    throw new Error("Archive uses reserved conversation identity");
  const fullEvidence = [...archive.evidence, ...conversationEvidence];
  const result: ExperimentResult = {
    arm: "grounded",
    model,
    corpusHash: archive.corpusHash,
    asOf: archive.asOf,
    questions: [],
    rejected: [],
    calls: [],
    evidenceIds: archive.evidence.map(e => e.id),
    searches: [],
    grounding: {
      research,
      reviewModel,
      context: fullEvidence,
      conversation: archive.conversation,
      withheldIds: archive.withheldIds,
      attempts: [],
      reviews: [],
    },
  };
  const shared = {
    artist: corpus.artist.name,
    asOf: archive.asOf,
    purpose: options.purpose,
    conversation: archive.conversation,
  };
  const candidates: {
    angle: (typeof research.angles)[number];
    evidence: InterviewEvidence[];
    catalog: ReturnType<typeof prepareInterviewCitations>;
    draft: InterviewDraft;
    rejection: string | null;
  }[] = [];
  const angles = archive.conversation ? research.angles.slice(0, 1) : research.angles;
  for (const angle of angles) {
    const requested = angle.noteIndexes.flatMap(i => research.notes[i].evidence);
    const opened = openInterviewContext(
      { ...corpus, evidence: archive.evidence },
      requested,
      archive.asOf,
    );
    const evidence = selectInterviewEvidence(
      [...conversationEvidence, ...opened.evidence],
      archive.asOf,
      60000,
    );
    const catalog = prepareInterviewCitations(evidence);
    const generated = await callInterviewModel(
      "grounded-draft",
      GROUNDED_WRITER_INSTRUCTION,
      {
        ...shared,
        angle,
        notebookIsFallible: research.notes.map(({ evidence: refs, ...note }, index) => ({
          index,
          ...note,
          originalSourceIds: refs.map(r => r.evidenceId),
        })),
        evidence: catalog.sources,
      },
      GROUNDED_DRAFT_SCHEMA,
      model,
    );
    result.calls.push(generated.call);
    if (!generated.output.question.trim()) continue;
    const draft = {
      question: generated.output.question,
      whyAsk: generated.output.whyAsk,
      unknown: generated.output.unknown,
      evidence: generated.output.citations.map(ref => {
        const quote = catalog.references[ref] ?? { evidenceId: ref, quote: "" };
        const source = evidence.find(e => e.id === quote.evidenceId);
        return { ...quote, evidenceId: source?.range?.sourceId ?? quote.evidenceId };
      }),
    };
    const rejection = validatePreparedInterviewDraft(draft, fullEvidence);
    candidates.push({ angle, evidence, catalog, draft, rejection });
  }

  // Critic sees every eligible original, including material omitted from the writer's packet.
  const review = async (items: typeof candidates, attempt: "draft" | "repair") => {
    if (!items.length) return;
    const checked = await callInterviewModel(
      "grounded-review",
      GROUNDED_REVIEW_INSTRUCTION,
      { ...shared, questions: items.map(i => i.draft), evidence: fullEvidence },
      GROUNDED_VERDICT_SCHEMA,
      reviewModel,
      "archive",
    );
    result.calls.push(checked.call);
    result.grounding!.reviews.push({
      attempt,
      questions: items.map(i => i.draft.question),
      verdicts: checked.output.verdicts,
    });
    for (const [index, item] of items.entries()) {
      const matches = checked.output.verdicts.filter(v => v.index === index);
      const v = matches.length === 1 ? matches[0] : null;
      const valid =
        v &&
        v.supported &&
        v.attributionCorrect &&
        v.respectsCorrections &&
        v.notAlreadyAnswered &&
        v.worthwhile &&
        v.temporalAccuracy &&
        v.respondsToAnswer &&
        v.respectsBoundaries &&
        v.singleQuestion &&
        v.acknowledgesConflicts &&
        v.premises.length > 0 &&
        v.premises.length <= 8 &&
        v.premises.every(p => p.status === "supported" || p.status === "open-question");
      item.rejection = valid ? null : (v?.reason ?? "Missing or duplicate verification verdict");
      if (!valid && v) {
        const hazards = v.premises.filter(
          p => p.status === "unsupported" || p.status === "contradicted",
        );
        if (hazards.length)
          item.rejection += "; " + hazards.map(p => p.claim + ": " + p.reason).join("; ");
      }
    }
  };
  await review(
    candidates.filter(c => !c.rejection),
    "draft",
  );
  const repairs: typeof candidates = [];
  for (const candidate of candidates) {
    result.grounding!.attempts.push({
      question: candidate.draft.question,
      attempt: "draft",
      rejection: candidate.rejection,
    });
    if (!candidate.rejection) {
      result.questions.push(candidate.draft);
      continue;
    }
    result.rejected.push({ draft: candidate.draft, reason: candidate.rejection });
    const repaired = await callInterviewModel(
      "grounded-repair",
      GROUNDED_WRITER_INSTRUCTION +
        "\nEdit the failed question using the concrete failure. This is the only repair attempt. For a compound question, KEEP ONE ASK and delete the other. Remove an unsupported premise rather than making it sound tentative while assuming it. Do not introduce a new chronology. You may return an empty question if the evidence cannot support a useful repair.",
      {
        ...shared,
        failedQuestion: candidate.draft.question,
        failure: candidate.rejection,
        angle: candidate.angle,
        evidence: candidate.catalog.sources,
        constraints: research.notes
          .filter(n => n.status !== "supported")
          .map(({ evidence: refs, ...note }) => ({
            ...note,
            originalSourceIds: refs.map(r => r.evidenceId),
          })),
      },
      GROUNDED_DRAFT_SCHEMA,
      model,
    );
    result.calls.push(repaired.call);
    if (!repaired.output.question.trim()) {
      result.grounding!.attempts.push({ question: "", attempt: "repair", rejection: "Abstained" });
      continue;
    }
    const draft = {
      ...candidate.draft,
      question: repaired.output.question,
      whyAsk: repaired.output.whyAsk,
      unknown: repaired.output.unknown,
      evidence: repaired.output.citations.map(ref => {
        const quote = candidate.catalog.references[ref] ?? { evidenceId: ref, quote: "" };
        const source = candidate.evidence.find(e => e.id === quote.evidenceId);
        return { ...quote, evidenceId: source?.range?.sourceId ?? quote.evidenceId };
      }),
    };
    repairs.push({
      ...candidate,
      draft,
      rejection: validatePreparedInterviewDraft(draft, fullEvidence),
    });
  }
  await review(
    repairs.filter(c => !c.rejection),
    "repair",
  );
  for (const repaired of repairs) {
    result.grounding!.attempts.push({
      question: repaired.draft.question,
      attempt: "repair",
      rejection: repaired.rejection,
    });
    if (repaired.rejection)
      result.rejected.push({ draft: repaired.draft, reason: repaired.rejection });
    else result.questions.push(repaired.draft);
  }
  result.questions = result.questions.filter(
    (q, i, all) => all.findIndex(p => p.question.toLowerCase() === q.question.toLowerCase()) === i,
  );
  return result;
}
