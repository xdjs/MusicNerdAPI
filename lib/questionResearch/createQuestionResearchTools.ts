import { tool } from "ai";
import { z } from "zod";
import {
  researchOutputSchemas,
  researchSourceIdSchema,
} from "@/lib/questionResearch/researchOutputSchemas";
import { readResearchJson } from "@/lib/questionResearch/readResearchJson";
import { validateQuestionResearchBody } from "@/lib/questionResearch/validateQuestionResearchBody";

/** Host-bound research tools for public chat or authorized agents; no approval or private-memory capability. */
export function createQuestionResearchTools(config: {
  apiOrigin: string;
  artistId: string;
  getHeaders: (signal: AbortSignal) => Promise<Record<string, string>>;
  timeoutMs?: number;
}) {
  const origin = new URL(config.apiOrigin);
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    !(
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))
    ) ||
    !z.uuid().safeParse(config.artistId).success
  )
    throw new Error("Trusted API origin and artist ID required");
  const bound = { ...config };
  const call = async (path: string, method: string, input?: unknown, signal?: AbortSignal) => {
    const abort = AbortSignal.any([
      AbortSignal.timeout(Math.min(30000, Math.max(1000, bound.timeoutMs ?? 15000))),
      ...(signal ? [signal] : []),
    ]);
    const headers = await bound.getHeaders(abort);
    abort.throwIfAborted();
    if (!headers.Authorization && !headers["X-MusicNerd-Research-Key"])
      throw new Error("Research authentication unavailable");
    const response = await fetch(`${origin.origin}/api/artist/${bound.artistId}/research/${path}`, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: abort,
      cache: "no-store",
      redirect: "error",
    });
    const body = (await readResearchJson(response)) as { status?: string };
    if (body?.status !== "ok") throw new Error("Research operation unavailable");
    return body;
  };
  return {
    requestArtistResearch: tool({
      description:
        "Request bounded research of a missing public fact. Use neutral topic/work terms, never private visitor chat. Saved originals are checked before supported external collection. Announce outside-Lore research using actual returned status. This never approves Lore or connects profiles. Unsupported speech remains unresolved.",
      outputSchema: researchOutputSchemas.status,
      inputSchema: z
        .object({
          topic: z.string().min(3).max(160),
          evidenceNeed: z.enum([
            "reporting",
            "release_date",
            "credits",
            "social_caption",
            "spoken_content",
          ]),
          freshness: z.enum(["stored", "recent"]).default("stored"),
          retrieval: z
            .enum(["relevance", "latest"])
            .optional()
            .describe(
              "Use latest for a newest-available overview; explicit dates and platform still constrain evidence.",
            ),
          targetUrl: z.string().url().max(2048).optional(),
          platform: z.enum(["instagram", "tiktok", "x"]).optional(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
        })
        .strict(),
      execute: async (input, { abortSignal }) =>
        researchOutputSchemas.status.parse(
          await call("questions", "POST", validateQuestionResearchBody(input), abortSignal),
        ),
    }),
    getResearchStatus: tool({
      description:
        "Read saved question-research progress and eligible original passages. Do not infer completion, ETA or absence from waiting/failure. Reuse the job; polling never starts another provider run. Pending discoveries are not artist-approved Lore.",
      outputSchema: researchOutputSchemas.status,
      inputSchema: z.object({ jobId: z.uuid() }).strict(),
      execute: async ({ jobId }, { abortSignal }) =>
        researchOutputSchemas.status.parse(
          await call(`questions/${jobId}`, "GET", undefined, abortSignal),
        ),
    }),
    readArtistSource: tool({
      description:
        "Read an exact public original revision with UTF-16 offsets. Read surrounding qualifications before making a claim. Title/caption/transcript, publisher/speaker, and publication/event date are distinct. Missing access or revisions must remain explicit.",
      outputSchema: researchOutputSchemas.read,
      inputSchema: z
        .object({
          sourceId: researchSourceIdSchema,
          revision: z.string().regex(/^[a-f0-9]{64}$/),
          start: z.number().int().min(0).max(4000000).default(0),
          maxChars: z.number().int().min(256).max(12000).default(4000),
        })
        .strict(),
      execute: async ({ sourceId, revision, start, maxChars }, { abortSignal }) =>
        researchOutputSchemas.read.parse(
          await call(
            `evidence/${encodeURIComponent(sourceId)}?${new URLSearchParams({ revision, start: String(start), maxChars: String(maxChars) })}`,
            "GET",
            undefined,
            abortSignal,
          ),
        ),
    }),
  };
}
