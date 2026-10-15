import { beforeEach, expect, it, vi } from "vitest";
import { withResearchRequest } from "../withResearchRequest";
import { ResearchQuotaError } from "../ResearchQuotaError";
vi.mock("@/lib/questionResearch/authenticateResearchRequest", () => ({
  authenticateResearchRequest: vi.fn().mockResolvedValue({ kind: "service" }),
}));
beforeEach(() => vi.clearAllMocks());
it("returns a shared quota scope and actual rolling reset in the body and Retry-After", async () => {
  const quota = {
    quotaScope: "saved_global" as const,
    resetAt: "2026-10-15T13:00:00.000Z",
    retryAfterSeconds: 123,
  };
  const response = await withResearchRequest(
    new Request("https://api.example/"),
    "11111111-1111-4111-8111-111111111111",
    false,
    async () => {
      throw new ResearchQuotaError(quota);
    },
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("123");
  expect(await response.json()).toMatchObject({
    status: "error",
    code: "saved_evidence_quota",
    ...quota,
  });
});
