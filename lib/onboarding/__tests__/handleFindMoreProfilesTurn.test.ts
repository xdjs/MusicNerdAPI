import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({ emitStep: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/onboarding/applyProfileLinkDecisions", () => ({
  applyProfileLinkDecisions: m.apply,
}));
const { handleFindMoreProfilesTurn } = await import("@/lib/onboarding/handleFindMoreProfilesTurn");

const empty = {
  written: [],
  identityBlocked: [],
  unrecognized: [],
  writeRejected: [],
  routedToVaultApproved: [],
  routedToVaultPending: [],
  vaultInsertFailed: [],
};

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.apply.mockReset().mockResolvedValue(empty);
});

describe("handleFindMoreProfilesTurn", () => {
  it("saves the artist's decisions first, then searches again", async () => {
    const events = await collect(
      handleFindMoreProfilesTurn(turnContext("profiles"), {
        type: "find_more_profiles",
        addedLinks: [{ url: "https://x" }],
        removedSiteNames: ["tiktok"],
      }),
    );
    expect(m.apply).toHaveBeenCalledWith("a1", [{ url: "https://x" }], ["tiktok"]);
    expect(m.emitStep).toHaveBeenCalledWith("a1", "profiles", { discoverProfiles: true });
    expect(events).toEqual([{ kind: "step", step: "profiles", payload: null }]);
  });

  it("works for an older client that sends no decisions, and reports failed links", async () => {
    m.apply.mockResolvedValueOnce({ ...empty, unrecognized: ["https://a"] });
    const events = await collect(
      handleFindMoreProfilesTurn(turnContext("profiles"), { type: "find_more_profiles" }),
    );
    expect(m.apply).toHaveBeenCalledWith("a1", [], []);
    expect(events[0]).toEqual({
      kind: "chat",
      text: expect.stringMatching(/paste the profile URL and I'll try again\.$/),
    });
  });

  it("refuses once the artist has moved past profiles", async () => {
    const events = await collect(
      handleFindMoreProfilesTurn(turnContext("vault"), { type: "find_more_profiles" }),
    );
    expect(events[0]).toEqual({
      kind: "error",
      message:
        "We've already moved past your profiles — finish this step and you can edit links from your page any time.",
    });
    expect(m.apply).not.toHaveBeenCalled();
  });
});
