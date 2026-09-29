import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({
  emitStep: vi.fn(),
  apply: vi.fn(),
  artist: vi.fn(),
  confirm: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/onboarding/applyProfileLinkDecisions", () => ({
  applyProfileLinkDecisions: m.apply,
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: m.artist }));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({ confirmOnboardingStep: m.confirm }));
vi.mock("@/lib/research/queueSocialIngest", () => ({ queueSocialIngest: m.queue }));
const { handleConfirmProfilesTurn } = await import("@/lib/onboarding/handleConfirmProfilesTurn");

const empty = {
  written: [],
  identityBlocked: [],
  unrecognized: [],
  writeRejected: [],
  routedToVaultApproved: [],
  routedToVaultPending: [],
  vaultInsertFailed: [],
};
const turn = (addedLinks: { url: string }[] = []) => ({
  type: "confirm_profiles" as const,
  addedLinks,
  removedSiteNames: [],
});

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.apply.mockReset().mockResolvedValue(empty);
  m.artist.mockReset().mockResolvedValue({ id: "a1", instagram: "nova" });
  m.confirm.mockReset().mockResolvedValue(undefined);
  m.queue.mockReset().mockResolvedValue(true);
});

describe("handleConfirmProfilesTurn", () => {
  it("confirms, queues the Instagram scrape and moves to the vault", async () => {
    const events = await collect(handleConfirmProfilesTurn(turnContext("profiles"), turn()));
    expect(m.confirm).toHaveBeenCalledWith("a1", "profiles");
    expect(m.queue).toHaveBeenCalledWith("a1", {});
    expect(events).toEqual([
      {
        kind: "chat",
        text: "Profiles confirmed. Now let's look at what the internet says about you.",
      },
      { kind: "step", step: "vault", payload: null },
    ]);
    expect(m.emitStep).toHaveBeenCalledWith("a1", "vault", { forceVaultDiscovery: false });
  });

  it("reports routed links and forces the web search when this turn added a source", async () => {
    m.apply.mockResolvedValueOnce({
      ...empty,
      routedToVaultApproved: ["https://nova.com"],
      routedToVaultPending: ["https://blog.com"],
    });
    const events = await collect(
      handleConfirmProfilesTurn(
        turnContext("profiles"),
        turn([{ url: "https://nova.com" }, { url: "https://blog.com" }]),
      ),
    );
    expect(events.map(e => (e as { text?: string }).text?.slice(0, 30))).toEqual([
      "That's not a platform profile:",
      "That's not a platform profile:",
      "Profiles confirmed. Now let's ",
      undefined,
    ]);
    expect(m.emitStep).toHaveBeenCalledWith("a1", "vault", { forceVaultDiscovery: true });
  });

  it("doesn't advance when every pasted link failed and the artist has no links", async () => {
    m.apply.mockResolvedValueOnce({ ...empty, unrecognized: ["https://a"] });
    m.artist.mockResolvedValueOnce({ id: "a1" });
    const events = await collect(
      handleConfirmProfilesTurn(turnContext("profiles"), turn([{ url: "https://a" }])),
    );
    expect(m.confirm).not.toHaveBeenCalled();
    expect(events.map(e => e.kind)).toEqual(["chat", "chat", "step"]);
    expect(events[1]).toEqual({
      kind: "chat",
      text: "Nothing saved yet — let's fix that before moving on. Paste the direct profile link below and I'll give it another shot.",
    });
    expect(m.emitStep).toHaveBeenCalledWith("a1", "profiles");
  });

  it("still advances when a link failed but the artist has others", async () => {
    m.apply.mockResolvedValueOnce({ ...empty, writeRejected: ["https://a"] });
    const events = await collect(
      handleConfirmProfilesTurn(turnContext("profiles"), turn([{ url: "https://a" }])),
    );
    expect(m.confirm).toHaveBeenCalled();
    expect(events[0]).toEqual({
      kind: "chat",
      text: expect.stringMatching(/Links section of your page, or reach out/),
    });
  });

  it("resyncs a stale card", async () => {
    const events = await collect(handleConfirmProfilesTurn(turnContext("vault"), turn()));
    expect(events[0]).toEqual({
      kind: "error",
      message: "We're not quite there yet — let's finish the earlier steps first.",
    });
    expect(m.apply).not.toHaveBeenCalled();
  });
});
