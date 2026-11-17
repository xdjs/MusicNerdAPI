/** Gateway model id (`provider/model`). The only place a model is named; every site uses Flash, as in MusicNerdWeb. */
export const MODEL_FLASH = "google/gemini-2.5-flash";

/** Public research uses the current Flash model for tool navigation, independently of legacy text calls. */
export const MODEL_PUBLIC_RESEARCH = "google/gemini-3.8-flash";

/** Writes artist chat answers (xdjs/MusicNerdWeb#1629). */
export const MODEL_CHAT = "anthropic/claude-sonnet-5.5";

/**
 * Grades chat answers in the eval: a different family from MODEL_CHAT, so the answerer never
 * marks its own work. Chosen on 2026-11-13 over Gemini 3.8 Flash and Gemini 4 Hydrogen on the
 * same ten answers: the most discriminating reasons, the only candidate that never failed a
 * call, and the fastest (docs/chat-eval-pdf-evidence.md).
 */
export const MODEL_JUDGE = "openai/gpt-5.4";

/** Embeds source units for hybrid search; priced from the gateway list on 2026-11-13. */
export const MODEL_EMBEDDING = "openai/text-embedding-3-small";

/** Reads scanned PDF pages as images (OCR); priced from the gateway list on 2026-11-13. */
export const MODEL_OCR = "google/gemini-3.8-flash";
