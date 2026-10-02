import { describe, it, expect, vi, beforeEach } from "vitest";
import { collect } from "@/lib/onboarding/__tests__/collect";
import { emitStepMock } from "@/lib/onboarding/__tests__/emitStepMock";
import { turnContext } from "@/lib/onboarding/__tests__/turnContext";

const m = vi.hoisted(() => ({
  emitStep: vi.fn(),
  answers: vi.fn(),
  upsert: vi.fn(),
  ack: vi.fn(),
}));
vi.mock("@/lib/onboarding/emitStep", () => ({ emitStep: m.emitStep }));
vi.mock("@/lib/lore/getInterviewAnswers", () => ({ getInterviewAnswers: m.answers }));
vi.mock("@/lib/onboarding/upsertInterviewAnswer", () => ({ upsertInterviewAnswer: m.upsert }));
vi.mock("@/lib/onboarding/generateInterviewAck", () => ({ generateInterviewAck: m.ack }));
const { handleInterviewAnswerTurn } = await import("@/lib/onboarding/handleInterviewAnswerTurn");

beforeEach(() => {
  m.emitStep.mockReset().mockImplementation(emitStepMock());
  m.answers.mockReset().mockResolvedValue([{ questionKey: "sound_in_own_words" }]);
  m.upsert.mockReset().mockResolvedValue(undefined);
  m.ack.mockReset().mockResolvedValue("Love that.");
});

describe("handleInterviewAnswerTurn", () => {
  it("stores the answer with the server's question text, acknowledges it and asks the next", async () => {
    const events = await collect(
      handleInterviewAnswerTurn(turnContext("interview"), {
        type: "interview_answer",
        questionKey: "offline_fact",
        answer: "  I cook  ",
        question: "ignored",
      }),
    );
    expect(m.upsert).toHaveBeenCalledWith({
      artistId: "a1",
      questionKey: "offline_fact",
      question: "What's something fans should know about you that isn't written anywhere online?",
      answer: "I cook",
      sitting: 1,
      source: "onboarding",
    });
    expect(m.ack).toHaveBeenCalledWith(expect.any(String), "I cook", 1);
    expect(events).toEqual([
      { kind: "chat", text: "Love that." },
      { kind: "step", step: "interview", payload: null },
    ]);
  });

  it("records a skip as null, with no acknowledgement", async () => {
    await collect(
      handleInterviewAnswerTurn(turnContext("interview"), {
        type: "interview_answer",
        questionKey: "offline_fact",
        answer: "   ",
      }),
    );
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ answer: null }));
    expect(m.ack).not.toHaveBeenCalled();
  });

  it("refuses an unknown key without writing", async () => {
    const events = await collect(
      handleInterviewAnswerTurn(turnContext("interview"), {
        type: "interview_answer",
        questionKey: "made_up",
        answer: "x",
      }),
    );
    expect(events[0]).toEqual({
      kind: "error",
      message: "Unknown question — let's continue from where we were.",
    });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("resyncs a stale card, so an old card can't overwrite an answer", async () => {
    await collect(
      handleInterviewAnswerTurn(turnContext("publish"), {
        type: "interview_answer",
        questionKey: "offline_fact",
        answer: null,
      }),
    );
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
