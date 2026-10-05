import { callInterviewModel } from "./callInterviewModel";
import { prepareInterviewCitations } from "./prepareInterviewCitations";
import { EDITORIAL_INSTRUCTION, EDITORIAL_SCHEMA } from "./editorialConst";
import type {
  InterviewConversation,
  InterviewEditorial,
  InterviewEvidence,
  InterviewResearch,
} from "./types";

/** Compare evidence-backed interview angles and anchor listening in the latest exact answer.
 * @param options - Complete eligible originals, fallible notes and validated conversation.
 * @returns Selected and discarded candidates with original references and measured usage.
 */
export async function selectInterviewAngles(options: {
  artist: string;
  asOf: string;
  purpose: string;
  notes: InterviewResearch["notes"];
  evidence: InterviewEvidence[];
  conversation: InterviewConversation | null;
  model: string;
}): Promise<InterviewEditorial> {
  const catalog = prepareInterviewCitations(options.evidence);
  const resolve = (ref: string) => {
    if (catalog.references[ref]) return catalog.references[ref];
    const split = ref.lastIndexOf("#");
    const original = catalog.references[ref.slice(split + 1)];
    return split > 0 && original?.evidenceId === ref.slice(0, split) ? original : undefined;
  };
  const maxSelected = options.conversation ? 1 : 3;
  const { output, call } = await callInterviewModel(
    "editorial-select",
    EDITORIAL_INSTRUCTION,
    {
      artist: options.artist,
      asOf: options.asOf,
      originalPreparationPurpose: options.purpose,
      mode: options.conversation ? "follow-up" : "opening",
      maxSelected,
      notebookIsFallible: options.notes,
      conversation: options.conversation,
      evidence: catalog.sources,
    },
    EDITORIAL_SCHEMA.extend({
      selectedIndexes: EDITORIAL_SCHEMA.shape.selectedIndexes.max(maxSelected),
    }),
    options.model,
    "archive",
  );
  try {
    if (output.candidates.length > 6) throw new Error("Too many editorial candidates");
    const selected = output.selectedIndexes;
    if (
      selected.length > maxSelected ||
      new Set(selected).size !== selected.length ||
      selected.some(i => !Number.isInteger(i) || !output.candidates[i])
    )
      throw new Error("Invalid selected angle indices");
    const candidates = output.candidates.map(({ citations, ...candidate }, index) => {
      if (!citations.length || citations.length > 8 || candidate.doNotAssume.length > 8)
        throw new Error("Editorial candidate requires bounded citations and constraints");
      const rejectedCitations = citations.filter(ref => !resolve(ref));
      return {
        ...candidate,
        decision:
          selected.includes(index) && !rejectedCitations.length
            ? ("select" as const)
            : ("discard" as const),
        ...(rejectedCitations.length
          ? {
              validationError: "Candidate rejected: unknown or mismatched citation",
              rejectedCitations,
            }
          : {}),
        evidence: rejectedCitations.length ? [] : citations.map(ref => resolve(ref)!),
      };
    });
    let listening: InterviewEditorial["listening"] = null;
    if (options.conversation) {
      const l = output.listening;
      if (!l || !l.citations.length || l.citations.length > 4 || l.limits.length > 8)
        throw new Error("Missing or unbounded latest-answer listening record");
      const turns = options.conversation.turns.filter(t => t.speaker === "artist");
      const latest = turns.at(-1)!;
      const anchors = l.citations.map(ref => {
        const original = resolve(ref);
        if (
          !original ||
          original.evidenceId !== `conversation:${turns.length - 1}` ||
          !latest.text.includes(original.quote)
        )
          throw new Error("Listening anchor must match the latest artist answer");
        return original;
      });
      if (l.nextMove === "stop" && selected.length)
        throw new Error("Stop listening move cannot select a question");
      listening = { anchors, meaning: l.meaning, limits: l.limits, nextMove: l.nextMove };
    } else if (output.listening !== null)
      throw new Error("Listening record requires a latest answer");
    if (Buffer.byteLength(JSON.stringify({ candidates, listening })) > 45000)
      throw new Error("Editorial candidates exceed the notebook budget");
    return {
      candidates,
      proposedSelectedIndexes: selected,
      selectedIndexes: selected.filter(i => candidates[i].decision === "select"),
      listening,
      call,
    };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("Invalid editorial output"), {
      editorialFailure: { output, call },
    });
  }
}
