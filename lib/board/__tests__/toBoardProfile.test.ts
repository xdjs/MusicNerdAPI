import { describe, expect, it } from "vitest";
import { toBoardProfile } from "@/lib/board/toBoardProfile";

describe("toBoardProfile", () => {
  it("names the profile <agent>-<member>, lowercased, with dashes for anything else", () => {
    expect(toBoardProfile("Claude", "sweetman")).toBe("claude-sweetman");
    expect(toBoardProfile("  Claude Code! ", "Sweetman")).toBe("claude-code-sweetman");
    expect(toBoardProfile("codex_2", "cy")).toBe("codex_2-cy");
  });

  it("shortens the agent so the whole name fits in 32 characters and keeps the member", () => {
    const profile = toBoardProfile("a very long agent name ".repeat(3), "sweetman");
    expect(profile.length).toBeLessThanOrEqual(32);
    expect(profile).toMatch(/^[a-z0-9_-]+-sweetman$/);
    expect(profile).not.toMatch(/--/);
  });

  it("calls the agent `agent` when its name has nothing usable", () => {
    expect(toBoardProfile("クロード", "pete")).toBe("agent-pete");
  });
});
