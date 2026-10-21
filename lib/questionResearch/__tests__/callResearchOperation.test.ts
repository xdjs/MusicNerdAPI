import { expect, it } from "vitest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { ResearchQuotaError } from "@/lib/questionResearch/ResearchQuotaError";
import { callResearchOperation } from "@/lib/questionResearch/callResearchOperation";
it("returns the operation's value untouched", async () => {
  expect(await callResearchOperation(async () => ({ status: "ok" }))).toEqual({ status: "ok" });
});
it("surfaces a quota the way the HTTP client did: status, bounded code and reset metadata", async () => {
  const quota = {
    quotaScope: "saved_global" as const,
    retryAfterSeconds: 120,
    resetAt: "2026-10-21T12:00:00Z",
  };
  await expect(
    callResearchOperation(async () => {
      throw new ResearchQuotaError(quota);
    }),
  ).rejects.toMatchObject({
    message: "The research limit has been reached. Try again later.",
    status: 429,
    code: "saved_evidence_quota",
    retryAfterSeconds: 120,
    resetAt: "2026-10-21T12:00:00.000Z",
  });
});
it("keeps research_busy and drops codes the Web client never accepted", async () => {
  await expect(
    callResearchOperation(async () => {
      throw new KnowledgeError("research_busy", 429, "PRIVATE");
    }),
  ).rejects.toMatchObject({ status: 429, code: "research_busy" });
  const other = await callResearchOperation(async () => {
    throw new KnowledgeError("forbidden", 403, "PRIVATE");
  }).catch(e => e);
  expect(other).toMatchObject({ status: 403, message: "Research is temporarily unavailable." });
  expect(other).not.toHaveProperty("code", "forbidden");
  expect(other.code).toBeUndefined();
  expect(other.message).not.toContain("PRIVATE");
});
it("maps a revision conflict to its message and anything else to a 503", async () => {
  await expect(
    callResearchOperation(async () => {
      throw new KnowledgeError("revision_changed", 409, "x");
    }),
  ).rejects.toMatchObject({
    status: 409,
    message: "The source changed. Reload the research before continuing.",
  });
  await expect(
    callResearchOperation(async () => {
      throw new TypeError("PRIVATE database detail");
    }),
  ).rejects.toMatchObject({ status: 503, message: "Research is temporarily unavailable." });
});
