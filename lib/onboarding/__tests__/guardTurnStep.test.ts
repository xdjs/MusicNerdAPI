import { describe, it, expect, vi, beforeEach } from "vitest";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const { emitStep } = vi.hoisted(() => ({
  emitStep: vi.fn(async function* (_a: string, step: string) {
    yield { kind: "step", step, payload: null };
  }),
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep }));
const { guardTurnStep } = await import("@/lib/onboarding/guardTurnStep");

async function run(gen: AsyncGenerator<unknown, boolean>) {
  const events = [];
  for (;;) {
    const s = await gen.next();
    if (s.done) return { events, proceed: s.value };
    events.push(s.value);
  }
}

beforeEach(() => {
  emitStep.mockClear();
});

describe("guardTurnStep", () => {
  it("lets a turn for the current step through, silently", async () => {
    expect(await run(guardTurnStep(turnContext("vault"), "vault", "wrong"))).toEqual({
      events: [],
      proceed: true,
    });
  });

  it("just completes once onboarding is done", async () => {
    expect(await run(guardTurnStep(turnContext(null), "vault", "wrong"))).toEqual({
      events: [
        { kind: "chat", text: expect.stringMatching(/^You're all set/) },
        { kind: "complete" },
      ],
      proceed: false,
    });
  });

  it("resyncs a stale card: the error, then the real current step", async () => {
    expect(await run(guardTurnStep(turnContext("interview"), "vault", "wrong"))).toEqual({
      events: [
        { kind: "error", message: "wrong" },
        { kind: "step", step: "interview", payload: null },
      ],
      proceed: false,
    });
  });
});
