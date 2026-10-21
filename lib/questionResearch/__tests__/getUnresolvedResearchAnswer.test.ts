import { expect, it } from "vitest";
import { getUnresolvedResearchAnswer } from "@/lib/questionResearch/getUnresolvedResearchAnswer";
it.each([
  [
    { outsideResearchReason: "quota" as const, limitations: [] },
    /Outside research is at its limit/,
  ],
  [{ limitations: ["provider_latest_refresh_required"] }, /can't refresh it from this chat/],
  [{ limitations: ["connected_account_required"] }, /connected account/],
  [{ limitations: ["unsupported_speech"] }, /what was said/],
  [{ limitations: ["something_else"] }, /don't have enough information/],
])("explains the status reason without a capability verdict: %j", (state, expected) => {
  expect(getUnresolvedResearchAnswer(state)).toMatch(expected);
});
