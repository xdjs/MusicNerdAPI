import { expect, it } from "vitest";
import { questionQuotaResponse } from "@/lib/questionResearch/questionQuotaResponse";
it("exposes only known budget scopes with bounded reset metadata and CORS", async () => {
  const response = questionQuotaResponse({
    code: "visitor_question_quota",
    retryAfterSeconds: 2520,
    resetAt: "2026-10-21T15:42:00Z",
    message: "PRIVATE",
  });
  expect(response?.status).toBe(429);
  expect(response?.headers.get("Retry-After")).toBe("2520");
  expect(response?.headers.get("X-MusicNerd-Quota")).toBe("true");
  expect(response?.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const body = await response!.json();
  expect(body).toEqual({
    status: "error",
    code: "visitor_question_quota",
    error: "You've reached your question limit for this hour. Try again in 42 minutes.",
    retryAfterSeconds: 2520,
    resetAt: "2026-10-21T15:42:00.000Z",
  });
});
it("omits unbounded or malformed reset metadata and says to try later", async () => {
  const response = questionQuotaResponse({
    code: "research_quota",
    retryAfterSeconds: 999999,
    resetAt: "nope",
  });
  expect(await response!.json()).toEqual({
    status: "error",
    code: "research_quota",
    error:
      "New web research has reached its allowance. You can still ask about saved sources. Please try again later.",
  });
  expect(response!.headers.get("Retry-After")).toBeNull();
});
it("returns null for errors without a known quota code", () => {
  expect(questionQuotaResponse(new Error("x"))).toBeNull();
  expect(questionQuotaResponse({ code: "research_busy" })).toBeNull();
  expect(questionQuotaResponse(null)).toBeNull();
});
