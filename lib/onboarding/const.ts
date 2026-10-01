/** The chat's forced chain. There's no stored cursor: the current step is the
 *  first one without a confirmation row. */
export const ONBOARDING_STEPS = ["profiles", "vault", "interview", "publish"] as const;

/** The onboarding interview: three questions, all skippable. Skipped ones return to
 *  the follow-up bank. The keys are shared with MusicNerdWeb's stored answers. */
export const ONBOARDING_QUESTIONS = [
  { key: "sound_in_own_words", question: "How would you describe your sound, in your own words?" },
  {
    key: "offline_fact",
    question: "What's something fans should know about you that isn't written anywhere online?",
  },
  { key: "working_on_now", question: "What are you working on right now?" },
] as const;
