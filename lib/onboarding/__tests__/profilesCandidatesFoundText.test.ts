import { describe, it, expect } from "vitest";
import { profilesCandidatesFoundText } from "@/lib/onboarding/profilesCandidatesFoundText";

describe("profilesCandidatesFoundText", () => {
  it("profilesCandidatesFoundText says they're already added", () => {
    expect(profilesCandidatesFoundText(1)).toBe(
      "I also found 1 more profile by searching the web and added it below — remove anything that isn't you.",
    );
    expect(profilesCandidatesFoundText(3)).toBe(
      "I also found 3 more profiles by searching the web and added them below — remove anything that isn't you.",
    );
  });
});
