import { beforeEach, expect, it, vi } from "vitest";
import { convertToModelMessages, type UIMessageChunk } from "ai";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
const turn = vi.fn();
vi.mock("@/lib/evals/chatStreamTurn", () => ({
  chatStreamTurn: (...args: unknown[]) => turn(...args),
}));
const { runGuardedChatConversation } = await import("@/lib/evals/runGuardedChatConversation");
const success = {
  answer: "Actual answer.",
  sources: [],
  firstTextMs: 1,
  totalMs: 2,
  evidenceCaptureComplete: true,
};
const chunks: UIMessageChunk[] = [
  { type: "start", messageId: "actual-id" },
  { type: "text-start", id: "text" },
  { type: "text-delta", id: "text", delta: "Actual answer." },
  { type: "text-end", id: "text" },
  { type: "finish", finishReason: "stop" },
];
beforeEach(() => {
  turn.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network_forbidden");
    }),
  );
  turn.mockImplementation(async (_input, _clock, capture) => {
    capture.claim();
    for (const chunk of chunks) capture.record("ui-chunk", chunk);
    return structuredClone(success);
  });
});
function setup(review = vi.fn(async () => "pass" as const)) {
  const execute = vi.fn();
  const factory = vi.fn(
    (
      _controls: Parameters<Parameters<typeof runGuardedChatConversation>[0]["createExecution"]>[0],
    ) => execute,
  );
  const options = {
    artistId: "artist",
    question: "Which aliases?",
    followUp: "Which evidence supports that?",
    requestId: "pair",
    maxCaptureBytes: 1000000,
    createExecution: factory,
    reviewFirst: review,
    write: vi.fn(),
  };
  return { options, factory, review, execute };
}
it("passes the SDK-reconstructed actual answer to follow-up and shares exactly one guard", async () => {
  const { options, factory, review, execute } = setup();
  const original = turn.getMockImplementation()!;
  let acceptedDuringSecond = false;
  turn.mockImplementation(async (...args) => {
    if (turn.mock.calls.length === 2) {
      const body = await validateArtistChatBody(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ messages: args[0].messages }),
        }),
      );
      if (!(body instanceof Response))
        acceptedDuringSecond = factory.mock.calls[0][0].continuation.validatePrompt(
          await convertToModelMessages(body.messages),
        );
    }
    return original(...args);
  });
  const result = await runGuardedChatConversation(options);
  expect(acceptedDuringSecond).toBe(true);
  expect(result.turns).toHaveLength(2);
  expect(factory).toHaveBeenCalledTimes(1);
  expect(turn.mock.calls[0][3]).toBe(execute);
  expect(turn.mock.calls[1][3]).toBe(execute);
  expect(turn.mock.calls[1][0].messages).toEqual([
    { id: "pair-user-1", role: "user", parts: [{ type: "text", text: "Which aliases?" }] },
    expect.objectContaining({
      id: "actual-id",
      role: "assistant",
      parts: [{ type: "text", text: "Actual answer.", state: "done" }],
    }),
    {
      id: "pair-user-2",
      role: "user",
      parts: [{ type: "text", text: "Which evidence supports that?" }],
    },
  ]);
  expect(review).toHaveBeenCalledTimes(1);
  const validate = factory.mock.calls[0][0].continuation.validatePrompt;
  expect(validate("different")).toBe(false);
  expect(
    validate([
      { role: "user", content: [{ type: "text", text: "Which aliases?" }] },
      { role: "assistant", content: [{ type: "text", text: "Actual answer." }] },
      { role: "user", content: [{ type: "text", text: "Which evidence supports that?" }] },
    ]),
  ).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["fail", "unscored"])("does not follow up after %s review", async verdict => {
  const { options } = setup(vi.fn(async () => verdict as "pass"));
  const result = await runGuardedChatConversation(options);
  expect(result.turns).toHaveLength(1);
  expect(result.stopped).toBe("first_quality_" + verdict);
});
it.each([
  { error: "failed" },
  { evidenceCaptureComplete: false },
  { attribution: { state: "partial", passages: [], pdfTextUnavailable: false } },
])("stops incomplete first transport before review: %j", async failure => {
  const { options, review } = setup();
  turn.mockResolvedValueOnce({ ...success, ...failure });
  const result = await runGuardedChatConversation(options);
  expect(result.turns).toHaveLength(1);
  expect(review).not.toHaveBeenCalled();
});
it("refuses duplicate quota claim and does not dispatch a second turn", async () => {
  const { options } = setup();
  turn.mockImplementationOnce(async (_i, _c, capture) => {
    capture.claim();
    capture.claim();
    return success;
  });
  await expect(runGuardedChatConversation(options)).rejects.toThrow(
    "conversation_duplicate_admission",
  );
  expect(turn).toHaveBeenCalledTimes(1);
});
it("aborts on a failed private sink before another turn", async () => {
  const { options } = setup();
  options.write.mockImplementation(() => {
    throw new Error("disk full");
  });
  await expect(runGuardedChatConversation(options)).rejects.toThrow("eval_capture_write");
  expect(turn).toHaveBeenCalledTimes(1);
});
it("aborted conversations cannot dispatch", async () => {
  const { options } = setup();
  await expect(
    runGuardedChatConversation({ ...options, signal: AbortSignal.abort() }),
  ).rejects.toThrow("conversation_aborted");
  expect(turn).not.toHaveBeenCalled();
});

it("retains actual attributed source hints without inventing prose or pages", async () => {
  const { options } = setup();
  const passage = {
    version: 1,
    id: "p",
    sourceId: "actual-source",
    revision: "r1",
    kind: "source-text",
    text: "Actual original.",
    start: 0,
    end: 16,
    sha256: "a".repeat(64),
  };
  turn.mockImplementationOnce(async (_i, _c, capture) => {
    capture.claim();
    for (const chunk of [
      { type: "start", messageId: "literal-id" },
      { type: "data-attributed-passage", data: passage },
      { type: "data-attributed-status", data: { state: "complete-transport" } },
      { type: "finish", finishReason: "stop" },
    ])
      capture.record("ui-chunk", chunk);
    return {
      ...success,
      answer: "",
      attribution: { state: "complete-transport", passages: [passage], pdfTextUnavailable: false },
    };
  });
  await runGuardedChatConversation(options);
  expect(turn.mock.calls[1][0].messages[1].parts).toContainEqual({
    type: "data-attributed-passage",
    data: passage,
  });
  expect(
    turn.mock.calls[1][0].messages[1].parts.some((p: { type: string }) => p.type === "text"),
  ).toBe(false);
});

it("enforces the caller's combined capture limit for UI records", async () => {
  const { options } = setup();
  await expect(runGuardedChatConversation({ ...options, maxCaptureBytes: 1 })).rejects.toThrow(
    "eval_capture_limit",
  );
  expect(turn).toHaveBeenCalledTimes(1);
});

it("aborts a pending human review rather than hanging past the pair deadline", async () => {
  const abort = new AbortController();
  const { options } = setup(vi.fn(async () => new Promise<"pass">(() => {})));
  options.reviewFirst.mockImplementation(async () => {
    abort.abort();
    return new Promise<"pass">(() => {});
  });
  await expect(runGuardedChatConversation({ ...options, signal: abort.signal })).rejects.toThrow(
    "conversation_aborted",
  );
  expect(turn).toHaveBeenCalledOnce();
});
