import { describe, expect, it } from "vitest";
import { getChatEffort } from "@/lib/chat/getChatEffort";

describe("getChatEffort", () => {
  it("is low for legacy whatever CHAT_EFFORT says", () => {
    expect(getChatEffort("legacy", { CHAT_EFFORT: "high" })).toBe("low");
  });

  it("reads low, medium or high in units, trimmed and case-insensitive", () => {
    expect(getChatEffort("units", { CHAT_EFFORT: "medium" })).toBe("medium");
    expect(getChatEffort("units", { CHAT_EFFORT: " HIGH " })).toBe("high");
    expect(getChatEffort("units", { CHAT_EFFORT: "Low" })).toBe("low");
  });

  it("falls back to low when unset, empty or not a level", () => {
    expect(getChatEffort("units", {})).toBe("low");
    expect(getChatEffort("units", { CHAT_EFFORT: "" })).toBe("low");
    expect(getChatEffort("units", { CHAT_EFFORT: "max" })).toBe("low");
    expect(getChatEffort("units", { CHAT_EFFORT: "high,low" })).toBe("low");
  });
});
