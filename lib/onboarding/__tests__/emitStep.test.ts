import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => {
  const gen = (label: string) =>
    vi.fn(async function* (..._a: unknown[]) {
      yield { kind: "chat", text: label };
    });
  return { profiles: gen("p"), vault: gen("v"), interview: gen("i"), publish: gen("pub") };
});
vi.mock("@/lib/onboarding/emitProfilesStep", () => ({ emitProfilesStep: m.profiles }));
vi.mock("@/lib/onboarding/emitVaultStep", () => ({ emitVaultStep: m.vault }));
vi.mock("@/lib/onboarding/emitInterviewStep", () => ({ emitInterviewStep: m.interview }));
vi.mock("@/lib/onboarding/emitPublishStep", () => ({ emitPublishStep: m.publish }));
const { emitStep } = await import("@/lib/onboarding/emitStep");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("emitStep", () => {
  it("emits each step's card, passing the discovery flags through", async () => {
    expect(await collect(emitStep("a1", "profiles", { discoverProfiles: true }))).toEqual([
      { kind: "chat", text: "p" },
    ]);
    expect(m.profiles).toHaveBeenCalledWith("a1", true);
    await collect(emitStep("a1", "vault", { forceVaultDiscovery: true }));
    expect(m.vault).toHaveBeenCalledWith("a1", true);
    await collect(emitStep("a1", "interview"));
    expect(m.interview).toHaveBeenCalledWith("a1");
    await collect(emitStep("a1", "publish"));
    expect(m.publish).toHaveBeenCalledWith("a1");
  });

  it("defaults both flags off", async () => {
    await collect(emitStep("a1", "profiles"));
    await collect(emitStep("a1", "vault"));
    expect(m.profiles).toHaveBeenCalledWith("a1", false);
    expect(m.vault).toHaveBeenCalledWith("a1", false);
  });
});
