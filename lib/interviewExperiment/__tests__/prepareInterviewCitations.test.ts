import { expect, it } from "vitest";
import { prepareInterviewCitations } from "../prepareInterviewCitations";
import { evidence } from "./evidence";
it("labels every original character without summarizing, joining distant text or changing provenance", () => {
  const source = evidence({
    text: "A detailed musical choice.\n".repeat(200) + "This recording was unrelated to the film.",
  });
  const catalog = prepareInterviewCitations([source]);
  expect(catalog.sources[0].passages.map(p => p.text).join("")).toBe(source.text);
  expect(catalog.sources[0].publishedAt).toBe(source.publishedAt);
  expect(catalog.sources[0].url).toBe(source.url);
  for (const passage of catalog.sources[0].passages)
    expect(catalog.references[passage.ref]).toEqual({ evidenceId: source.id, quote: passage.text });
  expect(Object.values(catalog.references).some(p => p.quote.includes("unrelated"))).toBe(true);
});
