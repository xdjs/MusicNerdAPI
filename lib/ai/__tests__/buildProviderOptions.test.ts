import { describe, it, expect } from "vitest";
import { buildProviderOptions } from "@/lib/ai/buildProviderOptions";

describe("buildProviderOptions", () => {
  it("returns undefined when no option is set", () => {
    expect(buildProviderOptions({})).toBeUndefined();
  });

  it("maps a Gemini thinking budget and level", () => {
    expect(buildProviderOptions({ thinkingBudget: 0, thinkingLevel: "low" })).toEqual({
      google: { thinkingConfig: { thinkingBudget: 0, thinkingLevel: "low" } },
    });
  });

  it("maps an Anthropic effort", () => {
    expect(buildProviderOptions({ anthropicEffort: "low" })).toEqual({
      anthropic: { effort: "low" },
    });
  });

  it("combines both providers", () => {
    expect(buildProviderOptions({ thinkingBudget: 0, anthropicEffort: "low" })).toEqual({
      google: { thinkingConfig: { thinkingBudget: 0, thinkingLevel: undefined } },
      anthropic: { effort: "low" },
    });
  });
});
