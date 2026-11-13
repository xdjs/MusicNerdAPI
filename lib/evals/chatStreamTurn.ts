import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import { readChatEvidence } from "@/lib/evals/readChatEvidence";
import { readPdfChatEvidence } from "@/lib/evals/readPdfChatEvidence";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";

/** Any origin: the handler reads only the path's id and the body. */
const ORIGIN = "http://localhost";
/** A documentation address (RFC 5737). Signed out, the allowance counts per IP, and the handler reads it from `x-real-ip` only when `VERCEL=1`. */
const VISITOR_IP = "192.0.2.1";

type Clock = { now: () => number };

const realClock: Clock = { now: () => performance.now() };

/** An earlier message of the conversation, as the artist page sends it back. */
export type HistoryMessage = { id: string; role: "user" | "assistant"; parts: unknown[] };

/**
 * One question through the streaming chat endpoint, in process, reading the UI message
 * stream the way `useChat` does: the first `text-delta` is when a fan first sees text, and
 * the end of the stream is the finished answer. `source-url` parts are the citable sources.
 * The turn's `assistantParts` are what a client would send back as this answer in a
 * follow-up: its completed PDF reads and its text.
 *
 * @param input - The case.
 * @param input.artistId - The artist's id on the database the suite runs against.
 * @param input.question - The fan's question.
 * @param clock - Time source; tests pass a fake one.
 * @param history - Earlier messages sent before the question, for a follow-up.
 * @returns The answer, its sources and timings, or the error it ended in.
 */
export async function chatStreamTurn(
  input: { artistId: string; question: string },
  clock: Clock = realClock,
  history: HistoryMessage[] = [],
): Promise<ChatTurn> {
  const { artistId, question } = input;
  const started = clock.now();
  const response = await postArtistChatHandler(
    new Request(`${ORIGIN}/api/artist/${artistId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_IP },
      body: JSON.stringify({
        messages: [
          ...history,
          {
            id: `eval-${history.length + 1}`,
            role: "user",
            parts: [{ type: "text", text: question }],
          },
        ],
      }),
    }),
    artistId,
  );
  if (!response.ok || !response.body) {
    const ms = Math.round(clock.now() - started);
    const data = await response.json().catch(() => ({}));
    const message = typeof data.error === "string" ? data.error : "error";
    const retryAfterSeconds =
      Number.isInteger(data.retryAfterSeconds) && data.retryAfterSeconds > 0
        ? (data.retryAfterSeconds as number)
        : undefined;
    return {
      answer: "",
      sources: [],
      evidence: [],
      firstTextMs: ms,
      totalMs: ms,
      error: `${response.status} ${message}`,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    };
  }

  let answer = "";
  let firstText: number | undefined;
  let firstSignal: number | undefined;
  let error: string | undefined;
  const sources: ChatTurn["sources"] = [];
  const evidence: NonNullable<ChatTurn["evidence"]> = [];
  const toolNames = new Map<string, string>();
  const tools: NonNullable<ChatTurn["tools"]> = [];
  // PDF tool outputs carry only metadata; the original is refetched after timing ends.
  const pdfReads: { tool: string; toolCallId: string; output: unknown }[] = [];
  const reader = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  }).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value.success) {
      error = "Malformed UI stream chunk.";
      continue;
    }
    const chunk = value.value;
    if (chunk.type === "tool-input-available" || chunk.type === "tool-input-start") {
      firstSignal ??= clock.now();
      toolNames.set(chunk.toolCallId, chunk.toolName);
      if (chunk.type === "tool-input-available")
        tools.push({ name: chunk.toolName, input: chunk.input, toolCallId: chunk.toolCallId });
    } else if (chunk.type === "tool-output-available") {
      const tool = toolNames.get(chunk.toolCallId) ?? "";
      if (tool === "readPdfSource" || tool === "readNamedPdf")
        pdfReads.push({ tool, toolCallId: chunk.toolCallId, output: chunk.output });
      else evidence.push(...readChatEvidence(tool, chunk.toolCallId, chunk.output));
    } else if (chunk.type === "text-delta") {
      firstText ??= clock.now();
      firstSignal ??= firstText;
      answer += chunk.delta;
    } else if (chunk.type === "source-url") {
      sources.push({ n: Number(chunk.sourceId), title: chunk.title ?? chunk.url, url: chunk.url });
    } else if (chunk.type === "error") {
      error = chunk.errorText;
    }
  }
  const totalMs = Math.round(clock.now() - started);
  for (const read of pdfReads) {
    const n = (read.output as { n?: unknown } | null)?.n;
    const source = sources.find(s => s.n === n);
    if (source)
      evidence.push(
        ...(await readPdfChatEvidence(read.tool, read.toolCallId, read.output, source.url)),
      );
  }
  const assistantParts: unknown[] = [
    ...pdfReads.map(read => ({
      type: `tool-${read.tool}`,
      toolCallId: read.toolCallId,
      state: "output-available",
      input: tools.find(t => t.toolCallId === read.toolCallId)?.input ?? {},
      output: read.output,
    })),
    { type: "text", text: answer },
  ];
  return {
    answer,
    sources,
    evidence,
    tools,
    assistantParts,
    firstTextMs: firstText === undefined ? totalMs : Math.round(firstText - started),
    firstSignalMs: firstSignal === undefined ? totalMs : Math.round(firstSignal - started),
    totalMs,
    ...(error ? { error } : {}),
  };
}
