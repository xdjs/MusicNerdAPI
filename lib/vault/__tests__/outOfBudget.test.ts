import { describe, it, expect } from "vitest";
import { outOfBudget } from "@/lib/vault/outOfBudget";

const run = (deadline: number, requireComplete = false) => ({ deadline, requireComplete }) as never;

describe("outOfBudget", () => {
  it("is false while time remains", () => {
    expect(outOfBudget(run(Date.now() + 10_000), "web search")).toBe(false);
    expect(outOfBudget(run(Number.POSITIVE_INFINITY, true), "web search")).toBe(false);
  });

  it("stops a best-effort run rather than writing behind the caller", () => {
    expect(outOfBudget(run(Date.now() - 1), "page verification")).toBe(true);
  });

  it("throws for a durable job, so it retries instead of finishing partial", () => {
    expect(() => outOfBudget(run(Date.now() - 1, true), "hub adoption")).toThrow(
      "Source search deadline exhausted before hub adoption",
    );
  });
});
