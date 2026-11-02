import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { readChatEvidence } from "@/lib/evals/readChatEvidence";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import type { streamText } from "@/lib/ai/streamText";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";

/** Any origin: the handler reads only the path's id and the body. */
const ORIGIN = "http://localhost";
/** A documentation address (RFC 5737). Signed out, the allowance counts per IP, and the handler reads it from `x-real-ip` only when `VERCEL=1`. */
const VISITOR_IP = "192.0.2.1";

export type ChatTurnCapture = {
  requestId: string;
  /** Synchronous, one-shot admission. Must reject duplicates before handler invocation. */
  claim: () => void;
  /** Capture failures abort the request; never silently continue without evidence. */
  record: (kind: string, value: unknown) => void;
  signal?: AbortSignal;
};

type Clock = { now: () => number };

const realClock: Clock = { now: () => performance.now() };

/**
 * One question through the streaming chat endpoint, in process, reading the UI message
 * stream the way `useChat` does: the first `text-delta` is received-text latency, not browser paint.
 * A finish event is required; end-of-stream alone is not success. `source-url` parts are the citable sources.
 *
 * @param input - The case.
 * @param input.artistId - The artist's id on the database the suite runs against.
 * @param input.question - The fan's question.
 * @param clock - Time source; tests pass a fake one.
 * @returns The answer, its sources and timings, or the error it ended in.
 */
export async function chatStreamTurn(
  input: { artistId: string; question: string; messages?: unknown[] },
  clock: Clock = realClock,
  capture?: ChatTurnCapture,
  executeStream?: typeof streamText,
): Promise<ChatTurn> {
  const { artistId, question } = input;
  const started = clock.now();
  const cancellation = new AbortController();
  const signal = capture?.signal
    ? AbortSignal.any([capture.signal, cancellation.signal])
    : cancellation.signal;
  const messages = input.messages ?? [
    { id: "eval", role: "user", parts: [{ type: "text", text: question }] },
  ];
  const record = (kind: string, value: unknown) => capture?.record(kind, value);
  const empty = (error: string): ChatTurn => ({
    answer: "",
    sources: [],
    evidence: [],
    firstTextMs: 0,
    totalMs: Math.round(clock.now() - started),
    error,
  });
  let response: Response;
  try {
    if (input.messages) {
      const last = messages.at(-1) as
        { role?: unknown; parts?: { type?: unknown; text?: unknown }[] } | undefined;
      if (
        last?.role !== "user" ||
        !Array.isArray(last.parts) ||
        last.parts
          .map(part => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
          .join("\n") !== question
      )
        throw new Error("question_messages_mismatch");
    }
    if (capture) {
      if (
        !capture.requestId ||
        typeof capture.claim !== "function" ||
        typeof capture.record !== "function"
      )
        throw new Error("missing_capture_controls");
      if (signal.aborted) throw new Error("aborted_before_dispatch");
      capture.claim();
      record("request", { requestId: capture.requestId, artistId, messages });
    }
    response = await postArtistChatHandler(
      new Request(`${ORIGIN}/api/artist/${artistId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_IP },
        body: JSON.stringify({ messages }),
        signal,
      }),
      artistId,
      ...(executeStream ? ([executeStream] as const) : []),
    );
    record("response", { status: response.status });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        `${response.status} ${typeof data.error === "string" ? data.error : "error"}`,
      );
    }
  } catch (cause) {
    cancellation.abort();
    const error = cause instanceof Error && cause.message ? cause.message : "request_failed";
    try {
      record("terminal", { outcome: "failed", error });
    } catch {
      /* Original failure remains authoritative. */
    }
    return empty(error);
  }

  let answer = "";
  let firstText: number | undefined;
  let error: string | undefined;
  const sources: ChatTurn["sources"] = [];
  const evidence: NonNullable<ChatTurn["evidence"]> = [];
  const toolNames = new Map<string, string>();
  let reader: ReturnType<ReturnType<typeof parseJsonEventStream>["getReader"]> | undefined;
  let finished = false;
  let aborted = false;
  const onAbort = () => {
    void reader?.cancel().catch(() => undefined);
  };
  try {
    reader = parseJsonEventStream({
      stream: response.body!,
      schema: uiMessageChunkSchema,
    }).getReader();
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value.success) {
        error = "Malformed UI stream chunk.";
        break;
      }
      const chunk = value.value as import("ai").UIMessageChunk;
      record("ui-chunk", chunk);
      if (finished) {
        error = "Chunk after finish.";
        break;
      }
      if (chunk.type === "finish") {
        finished = true;
        if (chunk.finishReason !== "stop") {
          error = `Incomplete model generation: ${chunk.finishReason ?? "missing finish reason"}.`;
          break;
        }
      }
      if (chunk.type === "abort") {
        aborted = true;
        error = "Aborted UI stream.";
        break;
      }
      if (chunk.type === "tool-input-available" || chunk.type === "tool-input-start") {
        toolNames.set(chunk.toolCallId, chunk.toolName);
      } else if (chunk.type === "tool-output-available") {
        evidence.push(
          ...readChatEvidence(
            toolNames.get(chunk.toolCallId) ?? "",
            chunk.toolCallId,
            chunk.output,
          ),
        );
      } else if (chunk.type === "text-delta") {
        firstText ??= clock.now();
        answer += chunk.delta;
      } else if (chunk.type === "source-url") {
        sources.push({
          n: Number(chunk.sourceId),
          title: chunk.title ?? chunk.url,
          url: chunk.url,
        });
      } else if (chunk.type === "error") {
        error = chunk.errorText || "stream_error";
        break;
      }
    }
  } catch (cause) {
    error = cause instanceof Error && cause.message ? cause.message : "stream_failed";
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (error || signal.aborted) cancellation.abort();
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
  if (signal.aborted || aborted) error ??= "Aborted UI stream.";
  if (!finished) error ??= "Incomplete UI stream: missing finish.";
  if (!answer.trim()) error ??= "Incomplete UI stream: no answer.";
  try {
    record("terminal", {
      outcome: error ? "failed" : "completed_transport",
      finished,
      aborted: signal.aborted || aborted,
      error,
    });
  } catch (cause) {
    error = cause instanceof Error && cause.message ? cause.message : "capture_failed";
  }
  const totalMs = Math.round(clock.now() - started);
  return {
    answer,
    sources,
    evidence,
    firstTextMs: firstText === undefined ? totalMs : Math.round(firstText - started),
    totalMs,
    ...(error ? { error } : {}),
  };
}
