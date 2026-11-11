import { createHash } from "node:crypto";
import {
  convertToModelMessages,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { NextResponse } from "next/server";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import { createBoundedChatCapture } from "@/lib/evals/createBoundedChatCapture";
import type { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import type { streamText } from "@/lib/ai/streamText";

type Prompt = Parameters<typeof streamText>[0]["prompt"];

/** Private two-turn evaluation orchestration. No CLI, model construction or automatic approval. */
export async function runGuardedChatConversation(options: {
  artistId: string;
  question: string;
  followUp: string;
  requestId: string;
  /** Same combined private-ledger limit as the trusted guard manifest. */
  maxCaptureBytes: number;
  /** Construct exactly one guarded execution with shared counters and this continuation validator. */
  createExecution: (controls: {
    record: (kind: string, value: unknown) => void;
    continuation: { validatePrompt: (prompt: Prompt) => boolean };
  }) => ReturnType<typeof createGuardedChatExecution>;
  /** Human evaluation, never inferred from clean transport; fail/unscored stops the pair. */
  reviewFirst: (
    turn: ChatTurn,
    message: UIMessage,
    signal: AbortSignal,
  ) => Promise<"pass" | "fail" | "unscored">;
  /** Exclusively created private synchronous sink owned by the caller. */
  write: (line: string) => void;
  signal?: AbortSignal;
  /** Trusted runner ledger, including preflight, shared without resetting its ceiling. */
  capture?: ReturnType<typeof createBoundedChatCapture>;
  /** Observe each turn’s corpus pin before permitting its first model call. */
  observe?: (kind: string, value: unknown) => void;
  beforeTurn?: () => void;
}) {
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(options.requestId)) throw new Error("conversation_request_id");
  for (const question of [options.question, options.followUp])
    if (!question.trim() || question.length > 500) throw new Error("conversation_question");
  const capture =
    options.capture ??
    createBoundedChatCapture({
      maxBytes: options.maxCaptureBytes,
      write: options.write,
    });
  if (capture.snapshot().maxBytes !== options.maxCaptureBytes)
    throw new Error("conversation_capture_mismatch");
  const signal = AbortSignal.any([
    AbortSignal.timeout(300000),
    capture.signal,
    ...(options.signal ? [options.signal] : []),
  ]);
  const check = () => {
    if (signal.aborted) throw new Error("conversation_aborted");
  };
  check();
  let expectedContinuation: string | undefined;
  let chunks: UIMessageChunk[] = [];
  const record = (kind: string, value: unknown) => {
    options.observe?.(kind, value);
    capture.record(kind, value);
    // Save only client-visible chunks, never server evidence or manually selected passages.
    if (kind === "ui-chunk") chunks.push(structuredClone(value) as UIMessageChunk);
  };
  const execute = options.createExecution({
    record,
    continuation: {
      validatePrompt: prompt =>
        expectedContinuation !== undefined && JSON.stringify(prompt) === expectedContinuation,
    },
  });
  const messages: UIMessage[] = [
    {
      id: `${options.requestId}-user-1`,
      role: "user",
      parts: [{ type: "text", text: options.question }],
    },
  ];
  const turns: ChatTurn[] = [];
  const run = async (index: number, question: string) => {
    check();
    options.beforeTurn?.();
    chunks = [];
    let claimed = false;
    const turn = await chatStreamTurn(
      {
        artistId: options.artistId,
        question,
        messages: structuredClone(messages),
        attributedTextCharacters: 12000,
      },
      undefined,
      {
        requestId: `${options.requestId}-${index}`,
        claim() {
          check();
          if (claimed) throw new Error("conversation_duplicate_admission");
          claimed = true;
        },
        record,
        signal: AbortSignal.any([signal, AbortSignal.timeout(150000)]),
      },
      execute,
    );
    turns.push(turn);
    check();
    return turn;
  };
  const first = await run(1, options.question);
  const complete = (turn: ChatTurn) =>
    !turn.error &&
    turn.evidenceCaptureComplete === true &&
    (turn.attribution
      ? turn.attribution.state === "complete-transport" &&
        turn.attribution.passages.length > 0 &&
        !turn.attribution.pdfTextUnavailable
      : !!turn.answer.trim());
  if (!complete(first))
    return { turns, stopped: "first_transport_incomplete", capture: capture.snapshot() };
  let assistant: UIMessage | undefined;
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  for await (const message of readUIMessageStream({ stream, terminateOnError: true }))
    assistant = message;
  if (!assistant || assistant.role !== "assistant" || !assistant.parts.length)
    throw new Error("conversation_missing_client_message");
  // Review receives a copy so it cannot change the captured history or first-turn result.
  const verdict = await new Promise<"pass" | "fail" | "unscored">((resolve, reject) => {
    const abort = () => reject(new Error("conversation_aborted"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    Promise.resolve()
      .then(() => {
        check();
        return options.reviewFirst(structuredClone(first), structuredClone(assistant), signal);
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
  check();
  capture.record("first-quality-review", {
    verdict,
    outputSha256: createHash("sha256")
      .update(JSON.stringify({ firstTurn: first, clientMessage: assistant }))
      .digest("hex"),
  });
  if (verdict !== "pass")
    return {
      turns,
      stopped: `first_quality_${verdict === "fail" ? "fail" : "unscored"}`,
      capture: capture.snapshot(),
    };
  messages.push(assistant, {
    id: `${options.requestId}-user-2`,
    role: "user",
    parts: [{ type: "text", text: options.followUp }],
  });
  // Bind the exact same public request normalization used by the actual handler.
  const body = await validateArtistChatBody(
    new Request("http://localhost/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }),
  );
  if (body instanceof NextResponse) throw new Error("conversation_followup_invalid");
  expectedContinuation = JSON.stringify(await convertToModelMessages(body.messages));
  const second = await run(2, options.followUp);
  expectedContinuation = undefined;
  return {
    turns,
    stopped: complete(second)
      ? "awaiting_followup_quality_review"
      : "followup_transport_incomplete",
    capture: capture.snapshot(),
  };
}
