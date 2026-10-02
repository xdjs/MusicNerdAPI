import { describe, it, expect } from "vitest";
import { settleAsCompleted } from "@/lib/async/settleAsCompleted";

const later = <T>(value: T, ms: number) => new Promise<T>(r => setTimeout(() => r(value), ms));

describe("settleAsCompleted", () => {
  it("yields each keyed promise in completion order, exactly once", async () => {
    const out: [string, number | null][] = [];
    for await (const entry of settleAsCompleted<string, number>([
      ["slow", later(1, 30)],
      ["fast", later(2, 5)],
    ]))
      out.push(entry);
    expect(out).toEqual([
      ["fast", 2],
      ["slow", 1],
    ]);
  });

  it("turns a rejection into null for that key instead of ending the stream", async () => {
    const out: [string, number | null][] = [];
    for await (const entry of settleAsCompleted<string, number>([
      ["bad", Promise.reject(new Error("x"))],
      ["good", later(3, 5)],
    ]))
      out.push(entry);
    expect(out).toEqual([
      ["bad", null],
      ["good", 3],
    ]);
  });
});
