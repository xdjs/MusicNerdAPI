import { expect, it } from "vitest";
import { readKnowledgePassage } from "@/lib/knowledge/readKnowledgePassage";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { rawKnowledge, vault } from "./fixtures";

it("keeps original UTF-16 coordinates when a historical window meets a surrogate pair", () => {
  const source = normalizeArtistKnowledge({
    ...rawKnowledge,
    vault: [{ ...vault, extractedText: "a".repeat(999) + "🎹" + "rest" }],
  }).sources[0];
  const input = {
    operation: "read" as const,
    sourceId: source.metadata.sourceId,
    revision: source.metadata.revision,
    start: 0,
    maxChars: 1000,
    includeVersion: true,
  };
  const version = {
    state: "historical" as const,
    currentRevision: "b".repeat(64),
    capturedAt: "2026-10-06T00:00:00.000Z",
  };
  const first = readKnowledgePassage(source, input, version);
  expect(first.passage.end).toBe(999);
  const second = readKnowledgePassage(source, { ...input, start: first.nextStart! }, version);
  expect(first.passage.text + second.passage.text).toBe(source.text);
  expect(first.version).toEqual(version);
  expect(second.passage.revision).toBe(source.metadata.revision);
  expect(second.passage.text.isWellFormed()).toBe(true);
});

it("rejects a revision or source identity mismatch rather than repairing the citation", () => {
  const source = normalizeArtistKnowledge({ ...rawKnowledge, vault: [vault] }).sources[0];
  const query = {
    operation: "read" as const,
    sourceId: source.metadata.sourceId,
    revision: "0".repeat(64),
    start: 0,
    maxChars: 1000,
  };
  expect(() => readKnowledgePassage(source, query)).toThrow(/revision changed/);
  expect(() =>
    readKnowledgePassage(source, {
      ...query,
      revision: source.metadata.revision,
      sourceId: "other",
    }),
  ).toThrow(/revision changed/);
});
