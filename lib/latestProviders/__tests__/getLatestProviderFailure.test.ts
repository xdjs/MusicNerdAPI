import { expect, it } from "vitest";
import { getLatestProviderFailure } from "../getLatestProviderFailure";
it("retains only allowlisted phase/code and HTTP status, never raw error content", () => {
  const raw = Object.assign(new Error("token=SECRET https://private.example"), {
    latestPhase: "token",
    latestCode: "http_error",
    status: 403,
    body: "SECRET",
  });
  expect(getLatestProviderFailure(raw)).toEqual({
    phase: "token",
    code: "http_error",
    httpStatus: 403,
  });
  expect(JSON.stringify(getLatestProviderFailure(raw))).not.toContain("SECRET");
});
it("rejects arbitrary labels and invalid statuses", () => {
  expect(
    getLatestProviderFailure({
      latestPhase: "SECRET",
      latestCode: "SECRET",
      status: "403",
      cause: "SECRET",
    }),
  ).toEqual({ phase: "unknown", code: "unknown", httpStatus: null });
});
