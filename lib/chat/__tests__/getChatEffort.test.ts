import { describe, expect, it } from "vitest";
import { getChatEffort } from "@/lib/chat/getChatEffort";

describe("getChatEffort", () => {
  it("reads low or medium, trimmed and case-insensitive", () => {
    expect(getChatEffort({ CHAT_EFFORT: "medium" })).toBe("medium");
    expect(getChatEffort({ CHAT_EFFORT: " MEDIUM " })).toBe("medium");
    expect(getChatEffort({ CHAT_EFFORT: "Low" })).toBe("low");
  });

  it("falls back to low when unset, empty or not a level", () => {
    expect(getChatEffort({})).toBe("low");
    expect(getChatEffort({ CHAT_EFFORT: "" })).toBe("low");
    expect(getChatEffort({ CHAT_EFFORT: "max" })).toBe("low");
    expect(getChatEffort({ CHAT_EFFORT: "high" })).toBe("low");
    expect(getChatEffort({ CHAT_EFFORT: "high,low" })).toBe("low");
  });
});
