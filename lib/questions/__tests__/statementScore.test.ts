import { describe, it, expect } from "vitest";
import { statementScore } from "@/lib/questions/statementScore";

const st = (quote: string) => ({ quote, topic: "t", url: "u" });

describe("statementScore", () => {
  it("scores naming somebody above substance, and substance in buckets", () => {
    expect(statementScore(st("short"))).toBe(0);
    expect(statementScore(st("x".repeat(121)))).toBe(1);
    expect(statementScore(st("x".repeat(301)))).toBe(2);
    expect(statementScore(st("cut with @zavodskyalan"))).toBe(3);
    expect(statementScore(st(`@abc ${"x".repeat(301)}`))).toBe(5);
  });
});
