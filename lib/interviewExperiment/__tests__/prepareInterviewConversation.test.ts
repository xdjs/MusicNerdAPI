import { expect, it } from "vitest";
import { corpus, evidence } from "./evidence";
import { prepareInterviewConversation } from "../prepareInterviewConversation";
it("withholds the full originating group and validates exact source offsets in published replay", () => {
  const source = evidence({
    id: "interview",
    kind: "lore",
    text: "Why drums? Because the room was echoing. Future answer hidden.",
  });
  const c = corpus([
    source,
    evidence({ id: "duplicate", group: source.group }),
    evidence({ id: "other", group: "another" }),
  ]);
  const input = {
    kind: "published" as const,
    artistId: c.artist.id,
    sourceId: source.id,
    turns: [
      { speaker: "interviewer" as const, text: "Why drums?", start: 0, end: 10 },
      { speaker: "artist" as const, text: "Because the room was echoing.", start: 11, end: 40 },
    ],
  };
  const result = prepareInterviewConversation(c, input);
  expect(result.withheldIds).toEqual(["interview", "duplicate"]);
  expect(result.corpus.evidence.map(e => e.id)).toEqual(["other"]);
  expect(result.turns[1].text).toBe(input.turns[1].text);
  expect(() =>
    prepareInterviewConversation(c, { ...input, turns: [{ ...input.turns[1], end: 43 }] }),
  ).toThrow();
});
it("requires explicit synthetic provenance, matching artist and a final artist answer", () => {
  const c = corpus();
  const input = {
    kind: "synthetic",
    artistId: c.artist.id,
    label: "Correction fixture, not artist testimony",
    turns: [{ speaker: "artist", text: "No, those recordings are unrelated." }],
  };
  expect(prepareInterviewConversation(c, input).turns[0].text).toBe(input.turns[0].text);
  expect(() => prepareInterviewConversation(c, { ...input, artistId: "other" })).toThrow();
  expect(() => prepareInterviewConversation(c, { ...input, label: "" })).toThrow();
  expect(() =>
    prepareInterviewConversation(c, {
      ...input,
      turns: [{ speaker: "interviewer", text: "Why?" }],
    }),
  ).toThrow();
});
