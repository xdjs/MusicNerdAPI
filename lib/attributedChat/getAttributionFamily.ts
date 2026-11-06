import type { AttributionFamily } from "./types";

/** Conservative question-family routing, not conflict detection or a completeness verdict. */
export function getAttributionFamily(
  question: string,
  previousQuestions: string[] = [],
): AttributionFamily | null {
  const q = question.trim().toLowerCase();
  // Do not inherit a family from a new, explicitly unrelated subject.
  if (
    /\b(?:calendar|work shifts?|meeting|festival dates?|database|variable names?|first name)\b/.test(
      q,
    ) ||
    /\b(?:edit|rewrite|paragraph|sentence|format)\b/.test(q)
  )
    return null;
  const inventory =
    /\b(?:aliases|alias|pseudonyms?|(?:stage|recording|artist|other) names?)\b/.test(q) ||
    (/\b(?:which|what) names\b/.test(q) &&
      /\b(?:use|used|perform|performed|record|recorded|release|released|known|went|go)\b/.test(q));
  if (
    inventory &&
    (/\b(?:which|what|when|years?|use|used|record|released|overlap|simultaneously)\b/.test(q) ||
      /^(?:please\s+)?(?:list|show|give\s+me)\b/.test(q))
  )
    return "alias-inventory";
  if (
    /\b(?:first|earliest|debut)\b/.test(q) &&
    /\b(?:album|record|release|song|track|single|ep|collaboration)s?\b/.test(q)
  )
    return "first-earliest";
  if (!previousQuestions.length) return null;
  const recent = previousQuestions.slice(-3);
  const previous = getAttributionFamily(recent.at(-1)!, recent.slice(0, -1));
  if (!previous) return null;
  const shortReference =
    /^(?:why|which (?:was|is) it|which one|how so|what do you mean)\s*[?.!]*$/.test(q);
  const sourceReference =
    /\b(?:(?:that|those|these|the (?:first|second|third|other)) (?:sources?|passages?|accounts?|aliases?|names?)|source \d)\b/.test(
      q,
    );
  const interpretiveReference =
    /\b(?:does|did|would|could|is|was) (?:that|this)\b/.test(q) &&
    /\b(?:earlier|album|single|collaboration|alias|name|source|passage)\b/.test(q);
  const inventoryReference =
    previous === "alias-inventory" &&
    /^(?:(?:did|do|were|are) (?:they|those|these).*(?:overlap|same time)|what overlap is documented)\s*[?.!]*$/.test(
      q,
    );
  // A bare name chronology question needs an active alias context, rather
  // than inheriting from an unrelated first-release discussion.
  const nameChronologyReference =
    previous === "alias-inventory" &&
    /^which name (?:came first|was (?:first|earliest))\s*[?.!]*$/.test(q);
  if (
    shortReference ||
    sourceReference ||
    interpretiveReference ||
    inventoryReference ||
    nameChronologyReference
  )
    return previous;
  return null;
}
