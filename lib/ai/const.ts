/** Gateway model id (`provider/model`). The only place a model is named; every site uses Flash, as in MusicNerdWeb. */
export const MODEL_FLASH = "google/gemini-2.5-flash";

/** Public research uses the current Flash model for tool navigation, independently of legacy text calls. */
export const MODEL_PUBLIC_RESEARCH = "google/gemini-3.8-flash";

/** Public Ask About intent planning stays separate from answer generation (MusicNerdWeb `MODEL_ASK_PLANNER`). */
export const MODEL_ASK_PLANNER = "google/gemini-3.8-flash";

/** Independent public Ask About writer (MusicNerdWeb `MODEL_ASK_DRAFT`). */
export const MODEL_ASK_DRAFT = "anthropic/claude-sonnet-5.5";

/** Independent public Ask About evidence checker (MusicNerdWeb `MODEL_ASK_CHECKER`). */
export const MODEL_ASK_CHECKER = "anthropic/claude-sonnet-5.5";
