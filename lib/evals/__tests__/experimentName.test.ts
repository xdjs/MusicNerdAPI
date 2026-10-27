import { describe, it, expect } from "vitest";
import { experimentName } from "@/lib/evals/experimentName";

describe("experimentName", () => {
  it("joins suite, model and the short sha with middle dots", () => {
    expect(experimentName("chat", "anthropic/claude-sonnet-5.5", "b7a4191e0c5f4a9d")).toBe(
      "chat · anthropic/claude-sonnet-5.5 · b7a4191",
    );
  });

  it("keeps a sha that is already short", () => {
    expect(experimentName("chat", "google/gemini-2.5-flash", "local")).toBe(
      "chat · google/gemini-2.5-flash · local",
    );
  });
});
