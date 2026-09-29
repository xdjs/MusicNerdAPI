import { GEMINI_TIMEOUT_MS } from "@/lib/lore/const";

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

/** What the chat says, verbatim from MusicNerdWeb. The two counted lines are
 *  `profilesCandidatesFoundText` and `vaultFoundText`. */
export const NARRATION = {
  building: "Your profile is yours. Building your page now, which takes a moment.",
  built:
    "Done. Your page is live below. You can edit anything on it, and take off anything that isn't you.",
  builtThin:
    "Done, though I didn't find much about you online yet. Your page is live below. Add a link or two and I'll have more to work with.",
  welcome:
    "Welcome! Your profile is officially yours — let's get it into shape. This takes about two minutes, and you can pick it back up anytime.",
  welcomeBack: "Welcome back — picking up right where you left off.",
  alreadyDone:
    "You're all set — your profile is published. You can edit anything from your page whenever you like.",
  profiles:
    "First: here's everything we have linked to you. Leaving a card as-is confirms it — remove anything that isn't you, or paste a profile we missed. Press and interviews come next.",
  profilesEmpty:
    "Let's start with where people can find you. Paste your Spotify, Instagram, or anywhere else you live online — or skip ahead and add them later.",
  profilesDone: "Profiles confirmed. Now let's look at what the internet says about you.",
  vaultEmpty:
    "We didn't find much about you on the web yet — no problem. Paste anything written about you below — press, an interview, a feature, your own site — or just continue.",
  vaultDone: "Sources sorted. Now the fun part — three quick questions. Skip any of them.",
  generating:
    "Okay, I have everything I need — building your knowledge document now from your links, your sources, and your own answers.",
  docReady:
    "Here's your knowledge document. It's the record everything else is built from — your About, your page's Q&A, your fun facts — so it's worth reading closely. Check the claims against the sources and fix anything I got wrong.",
  writingAbout: "Writing your About from the document.",
  selfWrite:
    "All yours — write it however you want. The document stays as your knowledge base either way.",
  draftReady: "Your About is ready. Publish it as-is, or edit it first — your call.",
  published:
    "You're live! Your About is published, and everything you shared is saved as your artist doc — it now powers your page's Q&A and fun facts too.",
} as const;

/** Error and recovery copy, verbatim from MusicNerdWeb. */
export const TURN_MESSAGES = {
  stateUnavailable: "We couldn't load your onboarding status — try again in a moment.",
  notYet: "We're not quite there yet — let's finish the earlier steps first.",
  pastProfiles:
    "We've already moved past your profiles — finish this step and you can edit links from your page any time.",
  unknownQuestion: "Unknown question — let's continue from where we were.",
  docOff: "That doc looks off — let me regenerate it.",
  aboutOff: "That About looks off — let me regenerate it.",
  missingStartingBio:
    "This draft is missing its starting bio. Reload and generate a fresh draft before publishing.",
  unknownTurn: "I didn't understand that — let's continue.",
  docRetry: "Hmm, that didn't come together — give me one more second.",
  simplerVersion: "Let's go with a simpler version for now.",
  aboutRetry: "One more try on the wording…",
  autoBuildPublishFailed:
    "Could not publish your About and Lore. Please try again; your saved bio is safe.",
  noAbout: "No About was produced. Please try again.",
  tookTooLong: "That took longer than expected — you can pick up right where you left off.",
  somethingWrong: "Something went wrong on our end — try that again.",
  profilesRetryNudge:
    "Nothing saved yet — let's fix that before moving on. Paste the direct profile link below and I'll give it another shot.",
} as const;

/** Progress groups: each collapses to one line that flips to done. */
export const PROFILE_SEARCH_GROUP = "platform-search";
export const VAULT_SEARCH_GROUP = "source-search";
export const DOC_GROUP = "about-write";

/** How long a step waits for the web source search; fits the 55 s turn deadline. */
export const VAULT_DISCOVERY_BUDGET_MS = 45_000;
/** Last-resort wait for an Instagram ingest to land before asking static questions. */
export const SOCIAL_INGEST_WAIT_MS = 8_000;
/** At most three interview questions at claim time. */
export const INTERVIEW_QUESTION_CAP = 3;
/** Cap on a client-echoed grounded question's text. */
export const MAX_CLIENT_QUESTION_CHARS = 500;
/** The interview acknowledgement is garnish: a model reply slower than this uses a fallback. */
export const ACK_TIMEOUT_MS = 5_000;
/** Rotated by question index so a run of misses never repeats. */
export const ACK_FALLBACKS = [
  "Love that — noted, in your words.",
  "Got it — that's in, just how you put it.",
  "Appreciate you sharing that — saved, word for word.",
  "Noted — thanks for putting that so plainly.",
] as const;
/** An ack claiming memory or apologising is replaced by the fallback. */
export const ACK_MEMORY_OR_APOLOGY_BLOCKLIST = [
  "misremembered",
  "i remember",
  "my apologies",
  "i thought",
  "sorry",
] as const;
/** A failed link longer than this is truncated in chat copy. */
export const FAILURE_URL_DISPLAY_MAX = 48;
/** Bounds the whole profile-preview batch. */
export const PROFILE_PREVIEW_BUDGET_MS = 5_000;
/** Cap on a client-echoed citation manifest. */
export const MAX_DOC_SOURCES = 200;
/** Past this much time in the publish step, a failed model call isn't retried. */
export const PUBLISH_RETRY_BUDGET_MS = GEMINI_TIMEOUT_MS + 10_000;
/** The route stops streaming after this, before the 60 s function limit. */
export const TURN_DEADLINE_MS = 55_000;
/** Longest client array a turn may carry (decisions, addedLinks, addedUrls). */
export const MAX_TURN_ARRAY_LEN = 100;
