import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("runs every item, never more than the limit at once, yielding as each settles", async () => {
    let inFlight = 0;
    let peak = 0;
    const run = async (n: number) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, (5 - n) * 3));
      inFlight--;
      return n * 10;
    };
    const out: [number, number][] = [];
    for await (const entry of mapWithConcurrency([1, 2, 3, 4, 5], 2, run)) out.push(entry);
    expect(peak).toBe(2);
    expect(out.map(([n]) => n).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(out.every(([n, r]) => r === n * 10)).toBe(true);
  });

  it("yields nothing for no items", async () => {
    const out = [];
    for await (const entry of mapWithConcurrency([], 3, async () => 1)) out.push(entry);
    expect(out).toEqual([]);
  });
});
