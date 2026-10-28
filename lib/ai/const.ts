/** Gateway model id (`provider/model`). The only place a model is named; every site uses Flash, as in MusicNerdWeb. */
export const MODEL_FLASH = "google/gemini-2.5-flash";

/** Public research uses the current Flash model for tool navigation, independently of legacy text calls. */
export const MODEL_PUBLIC_RESEARCH = "google/gemini-3.8-flash";

/** Public Ask About intent planning stays separate from answer generation (MusicNerdWeb `MODEL_ASK_PLANNER`). */
export const MODEL_ASK_PLANNER = "google/gemini-3.8-flash";

/** Writes artist chat answers, and Ask About's draft and evidence check until that path is deleted (xdjs/MusicNerdWeb#1629). */
export const MODEL_CHAT = "anthropic/claude-sonnet-5.5";
