import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const h = vi.hoisted(() => {
  const handler = (name: string) =>
    vi.fn(async function* (..._a: unknown[]) {
      yield { kind: "chat", text: name };
    });
  return {
    state: vi.fn(),
    open: handler("open"),
    findMore: handler("find_more_profiles"),
    confirm: handler("confirm_profiles"),
    vault: handler("vault_review"),
    interview: handler("interview_answer"),
    about: handler("about_choice"),
    publish: handler("publish"),
    unknown: handler("unknown"),
  };
});
vi.mock("@/lib/onboarding/getOnboardingState", () => ({ getOnboardingState: h.state }));
vi.mock("@/lib/onboarding/handleOpenTurn", () => ({ handleOpenTurn: h.open }));
vi.mock("@/lib/onboarding/handleFindMoreProfilesTurn", () => ({
  handleFindMoreProfilesTurn: h.findMore,
}));
vi.mock("@/lib/onboarding/handleConfirmProfilesTurn", () => ({
  handleConfirmProfilesTurn: h.confirm,
}));
vi.mock("@/lib/onboarding/handleVaultReviewTurn", () => ({ handleVaultReviewTurn: h.vault }));
vi.mock("@/lib/onboarding/handleInterviewAnswerTurn", () => ({
  handleInterviewAnswerTurn: h.interview,
}));
vi.mock("@/lib/onboarding/handleAboutChoiceTurn", () => ({ handleAboutChoiceTurn: h.about }));
vi.mock("@/lib/onboarding/handlePublishTurn", () => ({ handlePublishTurn: h.publish }));
vi.mock("@/lib/onboarding/handleUnknownTurn", () => ({ handleUnknownTurn: h.unknown }));
const { runOnboardingTurnInternal } = await import("@/lib/onboarding/runOnboardingTurnInternal");

const ownership = { userId: "u1", expectedClaimId: "c1" };
const state = { complete: false, currentStep: "vault" };

beforeEach(() => {
  h.state.mockReset().mockResolvedValue(state);
});

describe("runOnboardingTurnInternal", () => {
  it.each([
    "open",
    "find_more_profiles",
    "confirm_profiles",
    "vault_review",
    "interview_answer",
    "about_choice",
    "publish",
  ])("dispatches %s to its handler with the turn's context", async type => {
    const turn = { type } as never;
    expect(await collect(runOnboardingTurnInternal("a1", turn, ownership))).toEqual([
      { kind: "chat", text: type },
    ]);
  });

  it("hands the context and the turn to the handler", async () => {
    const turn = { type: "publish", doc: "d", about: "a", expectedBio: null } as const;
    await collect(runOnboardingTurnInternal("a1", turn, ownership));
    expect(h.publish).toHaveBeenCalledWith({ artistId: "a1", ownership, state }, turn);
  });

  it("sends an unknown turn type to the fallback", async () => {
    expect(
      await collect(runOnboardingTurnInternal("a1", { type: "dance" } as never, ownership)),
    ).toEqual([{ kind: "chat", text: "unknown" }]);
  });

  it("fails closed when the state can't be read, writing nothing", async () => {
    h.state.mockResolvedValueOnce(null);
    expect(await collect(runOnboardingTurnInternal("a1", { type: "open" }, ownership))).toEqual([
      {
        kind: "error",
        message: "We couldn't load your onboarding status — try again in a moment.",
      },
    ]);
    expect(h.open).not.toHaveBeenCalled();
  });
});
