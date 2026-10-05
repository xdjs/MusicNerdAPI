import { expect, it } from "vitest";
import { buildInterviewArchive } from "../buildInterviewArchive";
import { corpus, evidence } from "./evidence";

it("retains full eligible originals, with corrections first and future sources excluded", () => {
  const long = evidence({
    id: "pdf",
    kind: "lore",
    text: "Opening. " + "original ".repeat(9000) + "Last qualification.",
  });
  const correction = evidence({
    id: "fix",
    kind: "correction",
    text: "The album credit is rejected.",
  });
  const future = evidence({ id: "future", publishedAt: "2030-01-01" });
  const result = buildInterviewArchive(corpus([long, future, correction]));
  expect(result.evidence.map(e => e.id)).toEqual(["fix", "pdf"]);
  expect(result.evidence[1].text).toBe(long.text);
  expect(result.catalog.sources[1].passages.map(p => p.text).join("")).toBe(long.text);
});
it("refuses archives above the full-read limit rather than dropping documents", () => {
  expect(() => buildInterviewArchive(corpus([evidence({ text: "é".repeat(240000) })]))).toThrow(
    /complete archive/i,
  );
});
it("withholds the entire published replay group and does not hash synthetic turns into archive memory", () => {
  const text = "Why that room? The room had a long echo. SECRET LATER ANSWER";
  const archive = corpus([
    evidence({ id: "interview", text, group: "same" }),
    evidence({ id: "copy", group: "same" }),
    evidence({ id: "other" }),
  ]);
  const result = buildInterviewArchive(archive, {
    conversation: {
      kind: "published",
      artistId: archive.artist.id,
      sourceId: "interview",
      turns: [{ speaker: "artist", text: "The room had a long echo.", start: 15, end: 40 }],
    },
  });
  expect(result.evidence.map(e => e.id)).toEqual(["other"]);
  expect(result.withheldIds).toEqual(["interview", "copy"]);
  const a = buildInterviewArchive(archive);
  const b = buildInterviewArchive(archive, {
    conversation: {
      kind: "synthetic",
      artistId: archive.artist.id,
      label: "Test only",
      turns: [{ speaker: "artist", text: "That story is wrong." }],
    },
  });
  expect(a.corpusHash).toBe(b.corpusHash);
  expect(result.corpusHash).not.toBe(a.corpusHash);
  expect(b.conversation?.turns[0].text).toBe("That story is wrong.");
});
it("rejects a future replay source and ambiguous duplicate source identities", () => {
  expect(() =>
    buildInterviewArchive(corpus([evidence(), evidence({ text: "Different source." })])),
  ).toThrow(/duplicate/i);
  const c = corpus([evidence({ publishedAt: "2030-01-01" })]);
  expect(() =>
    buildInterviewArchive(c, {
      conversation: {
        kind: "published",
        artistId: c.artist.id,
        sourceId: "p1",
        turns: [
          { speaker: "artist", text: c.evidence[0].text, start: 0, end: c.evidence[0].text.length },
        ],
      },
    }),
  ).toThrow(/cutoff/i);
});
