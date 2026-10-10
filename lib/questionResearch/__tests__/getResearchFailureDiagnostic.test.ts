import { expect, it } from "vitest";
import { getResearchFailureDiagnostic } from "@/lib/questionResearch/getResearchFailureDiagnostic";

it("keeps only a known error class and numeric provider status", () => {
  const error = Object.assign(new Error("Bearer sk-secret; private source text"), {
    name: "AI_APICallError",
    statusCode: 401,
    requestBody: "private question",
  });
  const diagnostic = getResearchFailureDiagnostic(error, "assess");
  expect(diagnostic).toEqual({ step: "assess", name: "AI_APICallError", status: 401 });
  expect(JSON.stringify(diagnostic)).not.toMatch(/secret|source|question|Bearer/);
});

it("does not persist arbitrary names or nonnumeric status values", () => {
  const diagnostic = getResearchFailureDiagnostic(
    { name: "secret-in-class-name", statusCode: "401", message: "private" },
    "saved",
  );
  expect(diagnostic).toEqual({ step: "saved", name: "UnknownError", status: null });
});
it("records only allowlisted structured-output failure details", () => {
  expect(
    getResearchFailureDiagnostic(
      {
        name: "AI_NoObjectGeneratedError",
        finishReason: "length",
        cause: { name: "AI_TypeValidationError", message: "private completion" },
        text: "private completion",
      },
      "saved",
    ),
  ).toEqual({
    step: "saved",
    name: "AI_NoObjectGeneratedError",
    status: null,
    finishReason: "length",
    causeName: "AI_TypeValidationError",
  });
  expect(
    JSON.stringify(
      getResearchFailureDiagnostic(
        { finishReason: "private completion", cause: { name: "private completion" } },
        "saved",
      ),
    ),
  ).not.toContain("private completion");
});
