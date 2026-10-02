import type { DiscoveredProfile } from "@/lib/discovery/types";
import type { DocSource } from "@/lib/lore/types";
import type { ONBOARDING_QUESTIONS, ONBOARDING_STEPS } from "@/lib/onboarding/const";

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = { complete: boolean; currentStep: OnboardingStep | null };

export type OnboardingQuestionKey = (typeof ONBOARDING_QUESTIONS)[number]["key"];

/** "offered" is a question put to the artist and not yet dealt with: the boundary of a
 *  sitting. It becomes "followup" once they answer or skip it. */
export type InterviewAnswerSource = "onboarding" | "followup" | "offered";

/** A saved source as the research view shows it. */
export type SourceView = { title: string | null; url: string; ogImage: string | null };

/** One server-sent event of a chat turn. The shapes are the contract `useOnboardingChat` reads. */
export type TurnEvent =
  | { kind: "chat"; text: string }
  /** `group` marks a progress line that collapses with others (see the *_GROUP constants). */
  | { kind: "progress"; label: string; done: boolean; group?: string }
  | { kind: "step"; step: OnboardingStep; payload: unknown }
  /** A discovered profile, the instant it clears validation. */
  | { kind: "candidate"; profile: DiscoveredProfile }
  /** Auto-build only: the profiles actually written, after the identity guards. */
  | { kind: "linked"; profiles: DiscoveredProfile[] }
  /** Auto-build only: platforms that refused discovery, by display name. */
  | { kind: "unreachable"; platforms: string[] }
  /** Auto-build only: each source as the search saves it, then every approved source. */
  | { kind: "source"; source: SourceView }
  | { kind: "sources"; sources: SourceView[] }
  /** A piece of the Lore document or the About as the model writes it. */
  | { kind: "text-delta"; group: string; call: "doc" | "about"; delta: string }
  /** More than one account survived for a platform: `chosen` was written, `options` includes it. */
  | { kind: "choices"; platform: string; chosen: string; options: DiscoveredProfile[] }
  /** `sources` is the manifest narrowed to the ids either text cites. */
  | {
      kind: "draft";
      stage: "doc" | "about";
      doc: string;
      about: string | null;
      sources: DocSource[];
      selfWrite?: boolean;
      expectedBio?: string | null;
    }
  | { kind: "complete" }
  | { kind: "error"; message: string };

/** One chat turn from the client. Doc, About and sources round-trip through it (turns are stateless). */
export type ClientTurn =
  | { type: "open" }
  | { type: "confirm_profiles"; addedLinks: { url: string }[]; removedSiteNames: string[] }
  | { type: "find_more_profiles"; addedLinks?: { url: string }[]; removedSiteNames?: string[] }
  | {
      type: "vault_review";
      decisions: { sourceId: string; status: "approved" | "rejected" }[];
      addedUrls: string[];
    }
  | { type: "interview_answer"; questionKey: string; answer: string | null; question?: string }
  | { type: "about_choice"; mode: "generate" | "self"; doc: string; sources?: DocSource[] }
  | {
      type: "publish";
      doc: string;
      about: string;
      sources?: DocSource[];
      expectedBio: string | null;
    };

/** The turn being run and who is running it. */
export type TurnContext = {
  artistId: string;
  ownership: TurnOwnership;
  state: OnboardingState;
};

/** What applying the artist's profile-card decisions produced, bucketed by what went wrong. */
export interface ProfileLinkOutcome {
  /** siteNames actually written to the artist's row. */
  written: string[];
  /** Recognised, and refused because we couldn't prove it's this artist's. */
  identityBlocked: string[];
  unrecognized: string[];
  writeRejected: string[];
  routedToVaultApproved: string[];
  routedToVaultPending: string[];
  vaultInsertFailed: string[];
}

/** One interview question on offer. */
export interface InterviewQuestionCandidate {
  key: string;
  question: string;
  sourceUrls: string[];
}

/** State shared across one `applyProfileLinkDecisions` call, read lazily and at most once. */
export type LinkDecisionRun = {
  artistId: string;
  artistName?: string;
  /** URL → status of the artist's vault sources, so a repeated paste isn't inserted twice. */
  existingVaultStatusByUrl?: Map<string, string>;
};

/** The acting user and the claim a turn runs under. */
export type TurnOwnership = { userId: string; expectedClaimId: string | null };

/** What the auto-build's profile stage hands the source stage. */
export type AutoBuildProfilesResult = {
  /** Columns written from a name-built guess, so the search may replace them. */
  provisionalSiteNames: string[];
  /** The primary profile written for each platform. */
  discoveredBySiteName: Map<string, DiscoveredProfile>;
};
