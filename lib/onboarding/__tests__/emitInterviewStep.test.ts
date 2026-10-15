import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";

const m = vi.hoisted(() => ({
  answers: vi.fn(),
  questions: vi.fn(),
  confirm: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("@/lib/lore/getInterviewAnswers", () => ({ getInterviewAnswers: m.answers }));
vi.mock("@/lib/onboarding/getOnboardingInterviewPlan", () => ({
  getOnboardingInterviewPlan: m.questions,
}));
vi.mock("@/lib/onboarding/confirmOnboardingStep", () => ({ confirmOnboardingStep: m.confirm }));
vi.mock("@/lib/onboarding/emitPublishStep", () => ({ emitPublishStep: m.publish }));
const { emitInterviewStep } = await import("@/lib/onboarding/emitInterviewStep");

const q = (key: string) => ({ key, question: `Q ${key}`, sourceUrls: [] });

beforeEach(() => {
  m.answers.mockReset().mockResolvedValue([]);
  m.questions.mockReset().mockResolvedValue([q("a"), q("b"), q("c")]);
  m.confirm.mockReset().mockResolvedValue(undefined);
  m.publish.mockReset().mockImplementation(async function* () {
    yield { kind: "chat", text: "publish" };
  });
});

describe("emitInterviewStep", () => {
  it("asks the first unasked question, numbered by how many were asked", async () => {
    m.answers.mockResolvedValueOnce([{ questionKey: "a" }]);
    const events = await collect(emitInterviewStep("a1"));
    expect(events).toEqual([
      { kind: "progress", label: "Preparing your questions…", done: false },
      { kind: "progress", label: "Preparing your questions…", done: true },
      { kind: "chat", text: "Q b" },
      {
        kind: "step",
        step: "interview",
        payload: { questionKey: "b", question: "Q b", number: 2, total: 3, sourceUrls: [] },
      },
    ]);
  });

  it("confirms the interview and moves on to publish once three were asked, without generating", async () => {
    m.answers.mockResolvedValueOnce([
      { questionKey: "a" },
      { questionKey: "b" },
      { questionKey: "c" },
    ]);
    const events = await collect(emitInterviewStep("a1"));
    expect(m.questions).not.toHaveBeenCalled();
    expect(m.confirm).toHaveBeenCalledWith("a1", "interview");
    expect(events).toEqual([{ kind: "chat", text: "publish" }]);
  });

  it("does not generate or confirm completion when saved history cannot be read", async () => {
    m.answers.mockResolvedValueOnce(null);
    const events = await collect(emitInterviewStep("a1"));
    expect(m.questions).not.toHaveBeenCalled();
    expect(m.confirm).not.toHaveBeenCalled();
    expect(events).toEqual([
      { kind: "error", message: "We couldn't load your saved interview. Please try again." },
    ]);
  });
});
