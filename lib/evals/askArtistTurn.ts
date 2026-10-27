import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { getQuestionProgressHandler } from "@/lib/questionResearch/getQuestionProgressHandler";
import { postAskArtistHandler } from "@/lib/questionResearch/postAskArtistHandler";
import { postQuestionAnswerHandler } from "@/lib/questionResearch/postQuestionAnswerHandler";

/** Any origin: the handlers read only the path's ids and the body. */
const ORIGIN = "http://localhost";
/** A documentation address (RFC 5737). Signed out, the allowance counts per IP, and the handler reads it from `x-real-ip` only when `VERCEL=1`. */
const VISITOR_IP = "192.0.2.1";
/** MusicNerdWeb `runArtistResearch`: the client polls every 5 s and gives up after 5 min. */
const POLL_MS = 5000;
const TIMEOUT_MS = 5 * 60_000;
const TERMINAL = ["complete", "unresolved", "failed", "cancelled"];

type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

const realClock: Clock = {
  now: () => performance.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

/**
 * One question through today's Ask path, in process, following the responses exactly as
 * MusicNerdWeb's `runArtistResearch` does: `POST /api/askArtist`; on a 202 that is already
 * complete, the answer call; otherwise poll the job every 5 s (each poll runs one bounded
 * slice of research) and ask for the answer when it is terminal. Nothing streams, so the
 * first text arrives with the whole answer: `firstTextMs === totalMs`.
 *
 * @param input - The case.
 * @param input.artistId - The artist's id on the database the suite runs against.
 * @param input.question - The fan's question.
 * @param clock - Time source and sleep; tests pass a fake one.
 * @returns The answer, its sources and timings, or the error response it ended in.
 */
export async function askArtistTurn(
  input: { artistId: string; question: string },
  clock: Clock = realClock,
): Promise<ChatTurn> {
  const { artistId, question } = input;
  const started = clock.now();
  let resolvedQuestion: string | undefined;
  const finish = (data: Record<string, unknown>, error?: string): ChatTurn => {
    const ms = Math.round(clock.now() - started);
    const sources = Array.isArray(data.sources)
      ? data.sources.map(({ n, title, url }) => ({ n, title, url }))
      : [];
    return {
      answer: typeof data.answer === "string" ? data.answer : "",
      sources,
      firstTextMs: ms,
      totalMs: ms,
      ...(error ? { error } : {}),
    };
  };
  const post = async (jobId?: string) => {
    const path = jobId
      ? `/api/artist/${artistId}/questionResearch/${jobId}/answer`
      : "/api/askArtist";
    const request = new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": VISITOR_IP },
      body: JSON.stringify(
        jobId ? { question: resolvedQuestion ?? question } : { artistId, question },
      ),
    });
    const response = jobId
      ? await postQuestionAnswerHandler(request, artistId, jobId)
      : await postAskArtistHandler(request);
    const data = await response.json();
    if (typeof data.research?.resolvedQuestion === "string")
      resolvedQuestion = data.research.resolvedQuestion;
    return { status: response.status, data };
  };
  const failed = (r: { status: number; data: Record<string, unknown> }) =>
    finish({}, `${r.status} ${typeof r.data.error === "string" ? r.data.error : "error"}`);

  const first = await post();
  if (first.status >= 400) return failed(first);
  if (first.status !== 202) return finish(first.data);
  let jobId: string = first.data.research.jobId;
  if (first.data.research.stage === "complete") {
    const answer = await post(jobId);
    if (answer.status >= 400) return failed(answer);
    if (answer.status !== 202) return finish(answer.data);
    jobId = answer.data.research?.jobId ?? jobId;
  }
  while (clock.now() - started < TIMEOUT_MS) {
    const poll = await getQuestionProgressHandler(
      new Request(`${ORIGIN}/api/artist/${artistId}/questionResearch/${jobId}`),
      artistId,
      jobId,
    );
    const progress = await poll.json();
    if (!poll.ok) return failed({ status: poll.status, data: progress });
    if (TERMINAL.includes(progress.stage)) {
      const answer = await post(jobId);
      if (answer.status >= 400) return failed(answer);
      if (answer.status !== 202) return finish(answer.data);
      jobId = answer.data.research?.jobId ?? jobId;
    }
    await clock.sleep(POLL_MS);
  }
  return finish({}, "timed out");
}
