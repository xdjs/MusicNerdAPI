import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({ profiles: vi.fn(), sources: vi.fn(), about: vi.fn() }));
vi.mock("@/lib/onboarding/autoBuildProfiles", () => ({ autoBuildProfiles: m.profiles }));
vi.mock("@/lib/onboarding/autoBuildSources", () => ({ autoBuildSources: m.sources }));
vi.mock("@/lib/onboarding/autoBuildAbout", () => ({ autoBuildAbout: m.about }));
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
  m.about.mockReset().mockImplementation(async function* () {
    yield { kind: "complete" };
  });
});

describe("runAutoBuild", () => {
  it("runs the three stages in order, handing each what the last learned", async () => {
    const ownership = { userId: "u1", expectedClaimId: "c1" };
    const events = await collect(runAutoBuild("a1", ownership));
    expect(events).toEqual([
      {
        kind: "chat",
        text: "Your profile is yours. Building your page now, which takes a moment.",
      },
      { kind: "chat", text: "profiles" },
      { kind: "chat", text: "sources" },
      { kind: "complete" },
    ]);
    expect(m.sources).toHaveBeenCalledWith("a1", ["instagram"], found);
    expect(m.about).toHaveBeenCalledWith("a1", ownership, 2);
  });
});
