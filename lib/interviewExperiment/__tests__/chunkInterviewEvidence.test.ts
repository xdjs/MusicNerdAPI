import { describe, expect, it } from "vitest";
import { chunkInterviewEvidence } from "@/lib/interviewExperiment/chunkInterviewEvidence";
import { evidence } from "./evidence";
describe("chunkInterviewEvidence", () => {
  it("makes long documents retrievable without replacing original wording", () => {
    const original = evidence({
      kind: "lore",
      text: "SOURCE TITLE: Long interview\n" + "A recording story. ".repeat(500),
    });
    const chunks = chunkInterviewEvidence([original], 600);
    expect(chunks.length).toBeGreaterThan(5);
    expect(
      chunks.every(
        c => original.text.includes(c.text) && c.text.length <= 600 && c.group === original.group,
      ),
    ).toBe(true);
    expect(chunks.at(-1)?.text.endsWith("A recording story. ")).toBe(true);
  });
  it("retains complete corrections and prior answers", () => {
    const memory = evidence({ kind: "answer", text: "x".repeat(2000) });
    expect(chunkInterviewEvidence([memory], 600)).toEqual([memory]);
  });
});
