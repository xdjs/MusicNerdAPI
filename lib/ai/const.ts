/** Gateway model id (`provider/model`). The only place a model is named; every site uses Flash, as in MusicNerdWeb. */
export const MODEL_FLASH = "google/gemini-2.5-flash";

/** Public research uses the current Flash model for tool navigation, independently of legacy text calls. */
export const MODEL_PUBLIC_RESEARCH = "google/gemini-3.8-flash";

/** Writes artist chat answers (xdjs/MusicNerdWeb#1629). */
export const MODEL_CHAT = "anthropic/claude-sonnet-5.5";

/** Grades chat answers in the eval: a different family from MODEL_CHAT, so the answerer never marks its own work. */
export const MODEL_JUDGE = "google/gemini-3.8-flash";
