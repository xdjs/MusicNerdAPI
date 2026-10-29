import { expect, it } from "vitest";
import { validateCanvasSpec } from "../validateCanvasSpec";
import { canvasSeed } from "../const";
it("allows unseen combinations of known evidence without changing facts", () => {
  const spec = {
    blocks: [
      { id: "compare", kind: "comparison", title: "Two releases", items: ["teen", "out"], span: 2 },
      { id: "context", kind: "quote", title: "Artist voice", items: ["independence"], span: 1 },
    ],
  };
  expect(validateCanvasSpec(spec, canvasSeed, [], { blocks: [] })).toEqual(spec);
});
it("rejects unknown evidence and block types", () => {
  expect(() =>
    validateCanvasSpec(
      { blocks: [{ id: "x", kind: "cards", title: "x", items: ["invented"], span: 1 }] },
      canvasSeed,
      [],
      { blocks: [] },
    ),
  ).toThrow();
  expect(() =>
    validateCanvasSpec(
      { blocks: [{ id: "x", kind: "script", title: "x", items: ["out"], span: 1 }] },
      canvasSeed,
      [],
      { blocks: [] },
    ),
  ).toThrow();
});
it("preserves pinned blocks exactly and rejects invalid quote evidence", () => {
  const previous = {
    blocks: [
      { id: "t", kind: "timeline" as const, title: "Career", items: ["teen"], span: 2 as const },
    ],
  };
  expect(() => validateCanvasSpec({ blocks: [] }, canvasSeed, ["t"], previous)).toThrow();
  expect(() =>
    validateCanvasSpec(
      { blocks: [{ id: "q", kind: "quote", title: "Voice", items: ["out"], span: 1 }] },
      canvasSeed,
      [],
      { blocks: [] },
    ),
  ).toThrow();
});

it("rejects moving an otherwise unchanged pinned block", () => {
  const first = {
    id: "first",
    kind: "cards" as const,
    title: "First",
    items: ["meds"],
    span: 1 as const,
  };
  const pinned = {
    id: "pinned",
    kind: "cards" as const,
    title: "Pinned",
    items: ["out"],
    span: 1 as const,
  };
  expect(() =>
    validateCanvasSpec({ blocks: [pinned, first] }, canvasSeed, ["pinned"], {
      blocks: [first, pinned],
    }),
  ).toThrow("moved");
});
