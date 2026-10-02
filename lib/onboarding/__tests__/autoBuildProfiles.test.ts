import { describe, it, expect, vi, beforeEach } from "vitest";
import { profile } from "@/lib/onboarding/__tests__/profile";

const m = vi.hoisted(() => ({
  discover: vi.fn(),
  apply: vi.fn(),
  queue: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/discovery/discoverArtistProfilesStream", () => ({
  discoverArtistProfilesStream: m.discover,
}));
vi.mock("@/lib/onboarding/applyProfileLinkDecisions", () => ({
  applyProfileLinkDecisions: m.apply,
}));
vi.mock("@/lib/research/queueSocialIngest", () => ({ queueSocialIngest: m.queue }));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({ confirmOnboardingStep: m.confirm }));
const { autoBuildProfiles } = await import("@/lib/onboarding/autoBuildProfiles");

async function run(artistId = "a1") {
  const events = [];
  const gen = autoBuildProfiles(artistId);
  for (;;) {
    const step = await gen.next();
    if (step.done) return { events, result: step.value };
    events.push(step.value);
  }
}

const ig = profile("instagram", "nova", { provisional: true });
const ig2 = profile("instagram", "nova2");
const x = profile("x", "novax");

beforeEach(() => {
  m.discover.mockReset().mockImplementation(async function* () {
    yield { kind: "found", profile: ig };
    yield { kind: "found", profile: ig2 };
    yield { kind: "found", profile: x };
    yield { kind: "unreachable", platform: "tiktok", displayName: "TikTok" };
  });
  m.apply.mockReset().mockResolvedValue({ written: ["instagram", "x"] });
  m.queue.mockReset().mockResolvedValue(true);
  m.confirm.mockReset().mockResolvedValue(undefined);
});

describe("autoBuildProfiles", () => {
  it("writes one primary per platform through the identity guards and reports what landed", async () => {
    const { events, result } = await run();
    expect(m.apply).toHaveBeenCalledWith(
      "a1",
      [{ url: ig.profileUrl }, { url: x.profileUrl }],
      [],
      { verifyIdentity: true },
    );
    expect(events).toEqual([
      { kind: "progress", label: "Finding your profiles", done: false, group: "platform-search" },
      { kind: "candidate", profile: ig },
      { kind: "candidate", profile: ig2 },
      { kind: "candidate", profile: x },
      { kind: "linked", profiles: [ig, x] },
      { kind: "choices", platform: "instagram", chosen: "nova", options: [ig, ig2] },
      { kind: "unreachable", platforms: ["TikTok"] },
      { kind: "progress", label: "Found 3 profiles", done: true, group: "platform-search" },
    ]);
    expect(m.queue).toHaveBeenCalledWith("a1", {});
    expect(m.confirm).toHaveBeenCalledWith("a1", "profiles");
    expect(result.provisionalSiteNames).toEqual(["instagram"]);
    expect([...result.discoveredBySiteName.keys()]).toEqual(["instagram", "x"]);
  });

  it("offers no choice for a platform whose primary the guards refused", async () => {
    m.apply.mockResolvedValueOnce({ written: ["x"] });
    const { events, result } = await run();
    expect(events.some(e => e.kind === "choices")).toBe(false);
    expect(result.provisionalSiteNames).toEqual([]);
  });

  it("still queues the scrape and confirms when discovery finds nothing or fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.discover.mockImplementationOnce(async function* () {
      throw new Error("boom");
    });
    const { events } = await run();
    expect(m.apply).not.toHaveBeenCalled();
    expect(events.at(-1)).toEqual({
      kind: "progress",
      label: "Checked for your profiles",
      done: true,
      group: "platform-search",
    });
    expect(m.queue).toHaveBeenCalled();
    expect(m.confirm).toHaveBeenCalledWith("a1", "profiles");
    error.mockRestore();
  });
});
