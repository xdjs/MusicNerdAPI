import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({ emitStep: vi.fn(), autoBuild: vi.fn(), reuse: vi.fn() }));
vi.mock("@/lib/directoryPreparation/hasReusableDirectoryDiscovery", () => ({
  hasReusableDirectoryDiscovery: m.reuse,
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/onboarding/runAutoBuild", () => ({ runAutoBuild: m.autoBuild }));
const { handleOpenTurn } = await import("@/lib/onboarding/handleOpenTurn");

beforeEach(() => {
  m.reuse.mockReset().mockResolvedValue(false);
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.autoBuild.mockReset().mockImplementation(async function* () {
    yield { kind: "complete" };
  });
});

describe("handleOpenTurn", () => {
  it("builds the whole page for a fresh claim", async () => {
    const ctx = turnContext("profiles");
    expect(await collect(handleOpenTurn(ctx))).toEqual([{ kind: "complete" }]);
    expect(m.autoBuild).toHaveBeenCalledWith("a1", ctx.ownership);
  });

  it("resumes anywhere else with the step's card", async () => {
    expect(await collect(handleOpenTurn(turnContext("interview")))).toEqual([
      { kind: "chat", text: "Welcome back — picking up right where you left off." },
      { kind: "step", step: "interview", payload: null },
    ]);
    expect(m.autoBuild).not.toHaveBeenCalled();
  });

  it("says they're all set once complete", async () => {
    expect(await collect(handleOpenTurn(turnContext(null)))).toEqual([
      { kind: "chat", text: expect.stringMatching(/^You're all set/) },
      { kind: "complete" },
    ]);
  });
});

it("opens saved profiles without repeating any profile or source discovery", async () => {
  m.reuse.mockResolvedValue(true);
  const events = await collect(handleOpenTurn(turnContext("profiles")));
  expect(m.autoBuild).not.toHaveBeenCalled();
  expect(m.emitStep).toHaveBeenCalledWith("a1", "profiles");
  expect(events.at(-1)).toMatchObject({ kind: "step", step: "profiles" });
});
