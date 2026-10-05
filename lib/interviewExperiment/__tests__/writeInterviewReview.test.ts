import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { writeInterviewReview } from "@/lib/interviewExperiment/writeInterviewReview";
import { corpus } from "./evidence";
import type { ExperimentResult, InterviewResearch } from "../types";
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

it("writes reusable research and repair audit privately and resolves full original references", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mn-grounded-review-"));
  try {
    const c = corpus();
    c.evidence[0].text = "Complete original. ".repeat(2000);
    const research: InterviewResearch = {
      version: 1,
      promptVersion: "grounded-v1",
      artistId: c.artist.id,
      corpusHash: "hash",
      asOf: c.capturedAt,
      purpose: "Music",
      model: "writer",
      sourceIds: [c.evidence[0].id],
      characters: c.evidence[0].text.length,
      notes: [],
      angles: [],
      gaps: ["No listening"],
      call: { stage: "research", elapsedMs: 1, inputTokens: 2, outputTokens: 3, promptBytes: 4 },
    };
    const result: ExperimentResult = {
      arm: "grounded",
      model: "writer",
      corpusHash: "hash",
      asOf: c.capturedAt,
      calls: [],
      searches: [],
      rejected: [],
      evidenceIds: research.sourceIds,
      questions: [
        {
          question: "How did you choose that room?",
          whyAsk: "Process",
          unknown: "Choice",
          evidence: [{ evidenceId: c.evidence[0].id, quote: "Complete original." }],
        },
      ],
      grounding: {
        research,
        reviewModel: "critic",
        context: c.evidence,
        withheldIds: [],
        conversation: {
          kind: "synthetic",
          artistId: c.artist.id,
          label: "Test",
          turns: [{ speaker: "artist", text: "I picked a different room." }],
        },
        attempts: [
          { question: "Failed first question", attempt: "draft", rejection: "Compound question" },
        ],
        reviews: [],
      },
    };
    await writeInterviewReview(c, [result], dir);
    expect(await readFile(join(dir, "questions.md"), "utf8")).toContain("synthetic replay");
    expect(await readFile(join(dir, "evidence.md"), "utf8")).toContain(c.evidence[0].url!);
    expect(await readFile(join(dir, "research.md"), "utf8")).toContain("Compound question");
    expect(JSON.parse(await readFile(join(dir, "research.json"), "utf8"))).toEqual(research);
    expect(JSON.parse(await readFile(join(dir, "methods.json"), "utf8"))[0].reviewModel).toBe(
      "critic",
    );
    expect((await stat(join(dir, "research.json"))).mode & 0o777).toBe(0o600);
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
