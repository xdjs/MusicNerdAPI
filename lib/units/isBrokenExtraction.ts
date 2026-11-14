const MIN_WORD_CHARS = 40;
const MAX_MEAN_TOKEN_LENGTH = 20;
const MAX_NOISE_RATIO = 0.3;

const WORD_CHAR = /[\p{L}\p{N}]/u;
const COMMON_PUNCTUATION = /[.,;:!?'"`’‘“”()[\]{}\-–—/\\&%$@#*+=_<>|~^…•·]/u;

/** True when a PDF page's extracted text is too broken to index and should go to the vision pass. */
export function isBrokenExtraction(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  let wordChars = 0;
  let nonSpace = 0;
  let noise = 0;
  for (const char of text.replace(/\s+/g, "")) {
    nonSpace++;
    if (WORD_CHAR.test(char)) wordChars++;
    else if (!COMMON_PUNCTUATION.test(char)) noise++;
  }
  if (wordChars < MIN_WORD_CHARS) return true;
  if (nonSpace / tokens.length > MAX_MEAN_TOKEN_LENGTH) return true;
  return noise / nonSpace > MAX_NOISE_RATIO;
}
