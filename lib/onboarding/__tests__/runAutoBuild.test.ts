import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({
  profiles: vi.fn(),
  sources: vi.fn(),
  about: vi.fn(),
  review: vi.fn(),
}));
vi.mock("@/lib/onboarding/autoBuildProfiles", () => ({ autoBuildProfiles: m.profiles }));
vi.mock("@/lib/onboarding/autoBuildSources", () => ({ autoBuildSources: m.sources }));
vi.mock("@/lib/onboarding/autoBuildAbout", () => ({ autoBuildAbout: m.about }));
vi.mock("@/lib/onboarding/emitVaultStep", () => ({ emitVaultStep: m.review }));
const { runAutoBuild } = await import("@/lib/onboarding/runAutoBuild");

const found = new Map();
beforeEach(() => {
  m.profiles.mockReset().mockImplementation(async function* () {
    yield { kind: "chat", text: "profiles" };
    return { provisionalSiteNames: ["instagram"], discoveredBySiteName: found };
  });
  m.sources.mockReset().mockImplementation(async function* () {
    yield { kind: "chat", text: "sources" };
    return { citable: 2 };
  });
  m.review.mockReset().mockImplementation(async function* () {
    yield { kind: "step", step: "vault", payload: { sources: [] } };
  });
  m.about.mockReset().mockImplementation(async function* () {
    yield { kind: "complete" };
  });
});

describe("runAutoBuild", () => {
  it("discovers the profile then requires source review without publishing About", async () => {
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    const events = await collect(runAutoBuild("a1", ownership));
    expect(events).toEqual([
      {
        kind: "chat",
        text: "Your profile is yours. Building your page now, which takes a moment.",
      },
      { kind: "chat", text: "profiles" },
      { kind: "chat", text: "sources" },
      { kind: "step", step: "vault", payload: { sources: [] } },
    ]);
    expect(m.sources).toHaveBeenCalledWith("a1", ["instagram"], found);
    expect(m.about).not.toHaveBeenCalled();
    expect(m.review).toHaveBeenCalledWith("a1", false, true);
  });
});
