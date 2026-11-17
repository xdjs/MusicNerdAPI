import { describe, expect, it } from "vitest";
import { getLatestUserText } from "@/lib/chat/getLatestUserText";

const user = (...texts: string[]) => ({
  role: "user",
  parts: texts.map(text => ({ type: "text", text })),
});

describe("getLatestUserText", () => {
  it("joins the text parts of the last user message", () => {
    expect(
      getLatestUserText([
        user("old"),
        { role: "assistant", parts: [{ type: "text", text: "reply" }] },
        user("one", "two"),
      ]),
    ).toBe("one\ntwo");
  });

  it("skips non-text parts and returns empty without a user message", () => {
    expect(getLatestUserText([{ role: "user", parts: [{ type: "tool-x" }] }])).toBe("");
    expect(getLatestUserText([])).toBe("");
  });

  it("cuts at 300 characters on a code-point boundary", () => {
    const text = "\u{1F3B5}".repeat(301);
    expect(Array.from(getLatestUserText([user(text)]))).toHaveLength(300);
  });
});
