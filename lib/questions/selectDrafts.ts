import { ABOUT_A_PERSON } from "@/lib/questions/const";
import type { DraftedQuestion, EligibleDraft } from "@/lib/questions/types";

/**
 * Chooses which answers become drafts for the fact-checker. Clean answers come
 * before flagged ones. Two passes: the first holds roughly half the slots for
 * anything not about a person, since a collaborator-heavy artist would
 * otherwise fill every slot with people; the second gives unclaimed slots
 * back, so an all-collaborator artist still gets a full set.
 *
 * @param eligible - Resolved answers, in the model's order.
 * @param draftTarget - How many drafts to keep.
 * @returns Up to `draftTarget` drafts, each carrying its signal's material.
 */
export function selectDrafts(eligible: EligibleDraft[], draftTarget: number): DraftedQuestion[] {
  const ordered = [...eligible.filter(e => !e.boilerplate), ...eligible.filter(e => e.boilerplate)];
  const personSlots = Math.max(1, Math.ceil(draftTarget / 2));
  const drafted: DraftedQuestion[] = [];
  const deferred: EligibleDraft[] = [];
  let people = 0;
  for (const pass of [ordered, deferred]) {
    const deferring = pass === ordered;
    for (const e of pass) {
      if (drafted.length >= draftTarget) break;
      if (ABOUT_A_PERSON.has(e.candidate.kind)) {
        if (deferring && people >= personSlots) {
          deferred.push(e);
          continue;
        }
        people++;
      }
      drafted.push({
        key: e.candidate.key,
        question: e.question,
        rationale: e.rationale,
        sourceUrls: e.candidate.sourceUrls,
        kind: e.candidate.kind,
        materials: [e.candidate.material],
        demotedFor: e.boilerplate ?? undefined,
      });
    }
  }
  return drafted;
}
