import { getStructuredQuoteTexts } from "./getStructuredQuoteTexts";

/** Allow only collapsed whitespace in a contiguous quote; retain the original passage and offsets. A structured provider record also matches its decoded text fields, since JSON escaping is representation, not source wording. */
export function matchesOriginalQuote(
  original: string,
  quote: string,
  structuredRecord = false,
): boolean {
  const candidate = quote.trim();
  if (!candidate) return false;
  const collapse = (value: string) => value.replace(/\s+/gu, " ");
  const texts = structuredRecord ? [original, ...getStructuredQuoteTexts(original)] : [original];
  return texts.some(text => collapse(text).includes(collapse(candidate)));
}
