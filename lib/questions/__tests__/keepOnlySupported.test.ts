import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DraftedQuestion } from "@/lib/questions/types";

const { generateArray } = vi.hoisted(() => ({ generateArray: vi.fn() }));
vi.mock("@/lib/ai/generateArray", () => ({ generateArray }));
const { keepOnlySupported } = await import("@/lib/questions/keepOnlySupported");

const draft = (i: number, kind: DraftedQuestion["kind"] = "statement"): DraftedQuestion => ({
  key: `k${i}`,
  question: `q${i}`,
  rationale: "r",
  sourceUrls: [`u${i}`],
  kind,
  materials: [`m${i}`],
  demotedFor: i === 1 ? "too long to be spoken" : undefined,
});

beforeEach(() => generateArray.mockReset());

describe("keepOnlySupported", () => {
  it("sends every question with its source in one call and keeps only the approved ones", async () => {
    generateArray.mockResolvedValueOnce({
      output: [
        { i: 0, ok: true },
        { i: 1, ok: false, problem: "introduction to samplers" },
      ],
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const out = await keepOnlySupported([draft(0), draft(1), draft(2)], "Pete Rango");
    expect(out).toEqual([
      { key: "k0", question: "q0", rationale: "r", sourceUrls: ["u0"], kind: "statement" },
    ]);
    const call = generateArray.mock.calls[0][0];
    expect(call.prompt).toBe(
      'The artist is "Pete Rango".\n\n--- QUESTION 0 ---\nKIND: statement\nQ: q0\nSOURCE:\nm0\n\n--- QUESTION 1 ---\nKIND: statement\nQ: q1\nSOURCE:\nm1\n\n--- QUESTION 2 ---\nKIND: statement\nQ: q2\nSOURCE:\nm2',
    );
    expect(call.instructions.startsWith("You are fact-checking")).toBe(true);
    expect(call).toMatchObject({ temperature: 0, thinkingBudget: 512 });
    expect(log.mock.calls.flat().join(" ")).toContain("introduction to samplers");
    log.mockRestore();
  });

  it("needs contentSpecific for recent and Lore questions", async () => {
    generateArray.mockResolvedValueOnce({
      output: [
        { i: 0, ok: true, contentSpecific: false },
        { i: 1, ok: true, contentSpecific: true },
      ],
    });
    const out = await keepOnlySupported([draft(0, "lore"), draft(2, "recent")], "X");
    expect(out.map(q => q.key)).toEqual(["k2"]);
  });

  it("fails closed: nothing when the checker can't run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    generateArray.mockImplementationOnce(async () => {
      throw new Error("checker down");
    });
    expect(await keepOnlySupported([draft(0)], "X")).toEqual([]);
    error.mockRestore();
  });

  it("is empty without drafts, without calling the model", async () => {
    expect(await keepOnlySupported([], "X")).toEqual([]);
    expect(generateArray).not.toHaveBeenCalled();
  });
});
