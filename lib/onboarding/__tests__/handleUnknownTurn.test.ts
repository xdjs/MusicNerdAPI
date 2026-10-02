import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({ emitStep: vi.fn() }));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
const { handleUnknownTurn } = await import("@/lib/onboarding/handleUnknownTurn");

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
});

describe("handleUnknownTurn", () => {
  it("says it didn't understand and re-shows the current step", async () => {
    expect(await collect(handleUnknownTurn(turnContext("vault")))).toEqual([
      { kind: "error", message: "I didn't understand that — let's continue." },
      { kind: "step", step: "vault", payload: null },
    ]);
  });

  it("just completes once onboarding is done", async () => {
    expect((await collect(handleUnknownTurn(turnContext(null)))).at(-1)).toEqual({
      kind: "complete",
    });
  });
});
