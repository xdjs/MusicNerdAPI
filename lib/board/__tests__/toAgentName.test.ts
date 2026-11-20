import { describe, expect, it } from "vitest";
import { toAgentName } from "@/lib/board/toAgentName";

describe("toAgentName", () => {
  it("lowercases and dashes what isn't a letter, number, - or _", () => {
    expect(toAgentName("  Claude Duet! ")).toBe("claude-duet");
    expect(toAgentName("codex_2")).toBe("codex_2");
  });

  it("keeps at most 32 characters", () => {
    expect(toAgentName("a".repeat(40))).toHaveLength(32);
  });

  it("is null when nothing usable is left", () => {
    expect(toAgentName(" !! ")).toBeNull();
  });
});
