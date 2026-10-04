import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { writeInterviewReview } from "@/lib/interviewExperiment/writeInterviewReview";
import { corpus } from "./evidence";
import type { ExperimentResult } from "../types";
it("keeps method names out of the blind review and writes private evidence files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mn-interview-test-"));
  try {
    const result = {
      arm: "connections" as const,
      model: "test/model",
      corpusHash: "hash",
      asOf: "2026-01-01",
      questions: [],
      rejected: [],
      calls: [],
      evidenceIds: [],
      searches: [],
    };
    const path = await writeInterviewReview(corpus(), [result], dir);
    expect(await readFile(path, "utf8")).not.toContain("connections");
    expect(await readFile(join(dir, "methods.json"), "utf8")).toContain("connections");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(writeInterviewReview(corpus(), [result], dir)).rejects.toThrow(/EEXIST/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it("writes preparation coverage and resolves original references for expanded source windows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mn-prepared-review-"));
  try {
    const source = { ...corpus().evidence[0], id: "p1@0:36" };
    const result: ExperimentResult = {
      arm: "prepared",
      model: "test",
      corpusHash: "hash",
      asOf: "2026-01-01",
      calls: [],
      searches: [],
      rejected: [],
      evidenceIds: [source.id],
      questions: [
        {
          question: "What did the room change?",
          whyAsk: "Recording",
          unknown: "Its influence",
          evidence: [{ evidenceId: source.id, quote: source.text }],
        },
      ],
      preparation: {
        purpose: "Musical process",
        dossier: { alreadyExplained: [], angles: [], discarded: [], gaps: ["No audio listening"] },
        context: [source],
        omittedIds: ["unused"],
        memoryDocuments: [{ sourceId: "pdf", characters: 80000 }],
        memoryCalls: [],
        conversation: null,
        withheldIds: [],
      },
    };
    await writeInterviewReview(corpus(), [result], dir);
    expect(await readFile(join(dir, "preparation.md"), "utf8")).toContain(
      "80000 extracted characters",
    );
    expect(await readFile(join(dir, "evidence.md"), "utf8")).toContain(source.url!);
    expect((await stat(join(dir, "preparation.md"))).mode & 0o777).toBe(0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
