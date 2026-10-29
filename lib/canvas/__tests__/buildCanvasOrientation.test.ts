import { expect, it } from "vitest";
import { buildCanvasOrientation } from "../buildCanvasOrientation";
import { canvasSeeds, DUTCH_ARTIST_ID } from "../const";
it("orients through actual work and artist voice without inventing a biography", () => {
  const result = buildCanvasOrientation("Dutchyyy", canvasSeeds[DUTCH_ARTIST_ID]);
  expect(result.text).toContain("Junk Planet");
  expect(result.text).toContain("Archiving my life on-chain");
  expect(result.text).not.toContain("saved sources");
  expect(result.kind).toBe("orientation");
  expect(result.sources).toHaveLength(2);
});
it("does not borrow a different artist's identity or facts when evidence is sparse", () => {
  const result = buildCanvasOrientation("New Artist", []);
  expect(result.text).toContain("New Artist");
  expect(result.text).toContain("not enough public material");
  expect(result.sources).toEqual([]);
});
