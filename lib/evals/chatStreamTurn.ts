import { parseJsonEventStream, uiMessageChunkSchema } from "ai";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";

/** Any origin: the handler reads only the path's id and the body. */
const ORIGIN = "http://localhost";
/** A documentation address (RFC 5737). Signed out, the allowance counts per IP, and the handler reads it from `x-real-ip` only when `VERCEL=1`. */
const VISITOR_IP = "192.0.2.1";

type Clock = { now: () => number };

const realClock: Clock = { now: () => performance.now() };

/**
 * One question through the streaming chat endpoint, in process, reading the UI message
 * stream the way `useChat` does: the first `text-delta` is when a fan first sees text, and
 * the end of the stream is the finished answer. `source-url` parts are the citable sources.
 *
 * @param input - The case.
 * @param input.artistId - The artist's id on the database the suite runs against.
 * @param input.question - The fan's question.
 * @param clock - Time source; tests pass a fake one.
 * @returns The answer, its sources and timings, or the error it ended in.
 */
export async function chatStreamTurn(
  input: { artistId: string; question: string },
  clock: Clock = realClock,
): Promise<ChatTurn> {
  const { artistId, question } = input;
  const started = clock.now();
  const response = await postArtistChatHandler(
    new Request(`${ORIGIN}/api/artist/${artistId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_IP },
      body: JSON.stringify({
        messages: [{ id: "eval", role: "user", parts: [{ type: "text", text: question }] }],
      }),
    }),
    artistId,
  );
  if (!response.ok || !response.body) {
    const ms = Math.round(clock.now() - started);
    const data = await response.json().catch(() => ({}));
    const message = typeof data.error === "string" ? data.error : "error";
    return {
      answer: "",
      sources: [],
      firstTextMs: ms,
      totalMs: ms,
      error: `${response.status} ${message}`,
    };
  }

  let answer = "";
  let firstText: number | undefined;
  let error: string | undefined;
  const sources: ChatTurn["sources"] = [];
  const reader = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  }).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value.success) continue;
    const chunk = value.value;
    if (chunk.type === "text-delta") {
      firstText ??= clock.now();
      answer += chunk.delta;
    } else if (chunk.type === "source-url") {
      sources.push({ n: Number(chunk.sourceId), title: chunk.title ?? chunk.url, url: chunk.url });
    } else if (chunk.type === "error") {
      error = chunk.errorText;
    }
  }
  const totalMs = Math.round(clock.now() - started);
  return {
    answer,
    sources,
    firstTextMs: firstText === undefined ? totalMs : Math.round(firstText - started),
    totalMs,
    ...(error ? { error } : {}),
  };
}
