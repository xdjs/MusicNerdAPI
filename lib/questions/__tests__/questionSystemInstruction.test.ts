import { describe, it, expect } from "vitest";
import { questionSystemInstruction } from "@/lib/questions/questionSystemInstruction";

describe("questionSystemInstruction", () => {
  it("names the artist and keeps the attribution and JSON rules", () => {
    const text = questionSystemInstruction("Pete Rango");
    expect(
      text.startsWith(
        'You are a warm, well-prepared music journalist about to interview the artist "Pete Rango".',
      ),
    ).toBe(true);
    expect(text).toContain(
      "you must NEVER say or imply that Pete Rango wrote, said, or posted that caption/material",
    );
    expect(text).toContain('[{ "signalId": string, "question": string, "rationale": string }]');
    expect(text).not.toContain("${");
  });
});
