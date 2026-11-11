import { expect, it } from "vitest";
import { getLinkSuggestionEvidence } from "@/lib/artistLinkReview/getLinkSuggestionEvidence";
const observation = {
  version: 1,
  method: "name_web_search",
  artistName: "Nova",
  sourceUrl: "https://x.com/nova",
  observedTitle: null,
};
it("explains observations deterministically without promoting extra reasoning or a saved summary", () => {
  expect(
    getLinkSuggestionEvidence({
      ...observation,
      reasoning: "verified owner",
      summary: "verified owner",
    }),
  ).toEqual({
    method: "name_web_search",
    artistName: "Nova",
    sourceUrl: "https://x.com/nova",
    observedTitle: null,
    summary: "A platform search returned this profile with a handle matching “Nova”.",
  });
});
it("explains a name-derived probe without claiming ownership", () => {
  expect(
    getLinkSuggestionEvidence({
      ...observation,
      method: "name_handle_probe",
      observedTitle: "Nova",
    })?.summary,
  ).toBe(
    "A handle based on “Nova” led to this profile, and the recorded page title matched that name.",
  );
});
it.each([
  null,
  undefined,
  {},
  { ...observation, version: 2 },
  { ...observation, method: "model" },
  { ...observation, sourceUrl: "javascript:alert(1)" },
  { ...observation, sourceUrl: "not a url" },
  { ...observation, sourceUrl: "https://user:secret@x.com/nova" },
  { ...observation, sourceUrl: "https://x.com/nova?secret=x" },
  { ...observation, artistName: "" },
  { ...observation, observedTitle: "x".repeat(2001) },
  { ...observation, method: "name_handle_probe" },
])("returns unavailable for unsupported or malformed evidence: %j", raw => {
  expect(getLinkSuggestionEvidence(raw)).toBeNull();
});
