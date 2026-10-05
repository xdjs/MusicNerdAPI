import { stemmer } from "stemmer";

/** Matching terms with original UTF-16 locations; evidence itself is never rewritten. */
export function tokenizeKnowledgeText(text: string) {
  const stems = new Map<string, string>();
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’ʼ][\p{L}\p{N}\p{M}]+)*/gu)].map(
    match => {
      const term = match[0]
        .normalize("NFKD")
        .replace(/([A-Za-z])\p{M}+/gu, "$1")
        .toLowerCase()
        .replace(/['’ʼ]/g, "");
      if (!stems.has(term)) stems.set(term, /^[a-z]+$/.test(term) ? stemmer(term) : term);
      return {
        term,
        stem: stems.get(term)!,
        start: match.index,
        end: match.index + match[0].length,
      };
    },
  );
}
