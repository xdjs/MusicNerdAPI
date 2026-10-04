import { expect, it } from "vitest";
import { corpus, evidence } from "./evidence";
import { openInterviewContext } from "../openInterviewContext";
it("opens the entire caption including a late explicit denial and preserves metadata", () => {
  const source = evidence({
    text:
      "Watched a movie.\n" + "Other details. ".repeat(250) + "Recording unrelated to the movie.",
  });
  const result = openInterviewContext(corpus([source]), [
    { evidenceId: source.id, quote: "Watched a movie." },
  ]);
  expect(result.evidence[0]).toEqual(source);
  expect(result.omittedIds).toEqual([]);
});
it("reopens original long-document neighborhoods with stable offsets, pins corrections and reports omissions", () => {
  const text =
    "Earlier public answer.\n".repeat(1500) +
    "A special late recording detail.\n" +
    "Later qualification.\n".repeat(500);
  const source = evidence({ id: "pdf", kind: "lore", text });
  const correction = evidence({
    id: "c",
    kind: "correction",
    text: "REJECTED CLAIM: first release in 2015.",
  });
  const c = corpus([source, correction, evidence({ id: "unused" })]);
  const result = openInterviewContext(c, [
    { evidenceId: "pdf", quote: "A special late recording detail." },
  ]);
  const window = result.evidence.find(e => e.kind === "lore")!;
  expect(window.text).toContain("Later qualification.");
  expect(window.text).toBe(text.slice(window.range!.start, window.range!.end));
  expect(window.range!.sourceId).toBe("pdf");
  expect(result.evidence).toContainEqual(correction);
  expect(result.omittedIds).toEqual(["unused"]);
});
