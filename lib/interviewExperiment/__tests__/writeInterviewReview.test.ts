import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { writeInterviewReview } from "@/lib/interviewExperiment/writeInterviewReview";
import { corpus } from "./evidence";
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
