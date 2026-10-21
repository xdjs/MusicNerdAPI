import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { ResearchQuotaError } from "@/lib/questionResearch/ResearchQuotaError";

/** Run a research operation in process and fail the way Web's `callResearchApi` did over HTTP: a safe message by status, only the codes the chat flow understands, and bounded retry metadata. Nothing else about the underlying error reaches the visitor. */
export async function callResearchOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    // `withResearchRequest` turned anything but a KnowledgeError into a 503.
    const status = cause instanceof KnowledgeError ? cause.status : 503;
    let code: string | undefined = cause instanceof KnowledgeError ? cause.code : undefined;
    const quota = cause instanceof ResearchQuotaError ? cause.quota : undefined;
    const retryAfterSeconds: unknown = quota?.retryAfterSeconds;
    const resetAt: unknown = quota?.resetAt;
    if (!["saved_evidence_quota", "research_quota", "research_busy"].includes(String(code)))
      code = undefined;
    const error = new Error(
      status === 429
        ? "The research limit has been reached. Try again later."
        : status === 409
          ? "The source changed. Reload the research before continuing."
          : "Research is temporarily unavailable.",
    );
    Object.assign(error, {
      status,
      code,
      ...(code &&
      typeof retryAfterSeconds === "number" &&
      Number.isInteger(retryAfterSeconds) &&
      retryAfterSeconds > 0 &&
      retryAfterSeconds <= 86400
        ? { retryAfterSeconds }
        : {}),
      ...(code && typeof resetAt === "string" && Number.isFinite(Date.parse(resetAt))
        ? { resetAt: new Date(resetAt).toISOString() }
        : {}),
    });
    throw error;
  }
}
