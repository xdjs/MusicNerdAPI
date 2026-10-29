import { expect, it, vi } from "vitest";
import { scopeCanvasOriginals } from "../scopeCanvasOriginals";
import { createCanvasContext } from "../createCanvasContext";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
const out = originalFixture(
  "out",
  "https://artist.bandcamp.com/album/out-here",
  "OUT HERE | Artist\nBuy all albums OUT HERE and MEDS BY TASH\nabout\nAn electronic album.\ncredits\nreleased September 25, 2026\nlicense\nall rights reserved\nabout\nArtist is a producer\ndiscography\nMEDS BY TASH",
);
const meds = originalFixture(
  "meds",
  "https://artist.bandcamp.com/album/meds-by-tash",
  "MEDS BY TASH | Artist\nBuy all albums including OUT HERE\nabout\nA meditation tape.\ncredits\nProduced and written Artist\nlicense\nall rights reserved\ndiscography\nOUT HERE",
);
const request = {
  version: "canvas.v1" as const,
  sessionId: "11111111-1111-4111-8111-111111111111",
  turnId: "22222222-2222-4222-8222-222222222222",
  baseRevision: 0,
  spec: { blocks: [] },
  pinnedIds: [],
  selectedIds: [],
  focusId: null,
};
it("searches an album own content without unrelated album credits or navigation", () => {
  const scoped = scopeCanvasOriginals([out, meds], "Who produced OUT HERE?");
  expect(scoped.map(s => s.sourceId)).toEqual(["out"]);
  expect(scoped[0].text).not.toContain("MEDS");
  expect(scoped[0].text).not.toContain("Artist is a producer");
  expect(scopeCanvasOriginals([out, meds], "Compare OUT HERE and MEDS BY TASH")).toHaveLength(2);
});
it("preserves empty equipment searches and refuses unrelated source citations", async () => {
  const cite = vi.fn();
  const context = createCanvasContext(
    request,
    [out, meds],
    cite,
    [],
    [],
    "Which synthesizer was used on OUT HERE?",
    "Artist",
  );
  const result = (await context.searchSources.execute!({ query: "OUT HERE" }, {
    toolCallId: "x",
    messages: [],
  } as never)) as { sources: unknown[] };
  expect(result.sources).toEqual([]);
  expect(
    await context.readSource.execute!({ sourceId: "out" }, {
      toolCallId: "y",
      messages: [],
    } as never),
  ).toHaveProperty("error");
  expect(cite).not.toHaveBeenCalled();
});
it("retains explicit negative equipment evidence for a useful negative answer", () => {
  const negative = originalFixture(
    "negative",
    "https://example.com/interview",
    "I did not use a synthesizer on that recording.",
  );
  expect(scopeCanvasOriginals([negative], "What synthesizer was used?")[0].text).toContain(
    "did not use",
  );
});
it("does not let curated cards bypass equipment scope, while retaining an existing canvas for a negative answer", async () => {
  const block = {
    id: "existing",
    kind: "cards" as const,
    title: "Starting work",
    items: ["out"],
    span: 1 as const,
  };
  const cite = vi.fn();
  const context = createCanvasContext(
    { ...request, spec: { blocks: [block] } },
    [],
    cite,
    undefined,
    [],
    "Which synthesizer was used on OUT HERE?",
    "LATASHA",
  );
  expect(
    await context.readSource.execute!({ sourceId: "out" }, {
      toolCallId: "x",
      messages: [],
    } as never),
  ).toHaveProperty("error");
  expect(cite).not.toHaveBeenCalled();
  expect(
    await context.composeCanvas.execute!(
      {
        blocks: [block],
        explanation:
          "The saved sources do not establish which synthesizer was used. I kept the existing work for context.",
      },
      { toolCallId: "y", messages: [] } as never,
    ),
  ).toMatchObject({ accepted: true });
  expect(
    await context.composeCanvas.execute!(
      {
        blocks: [{ ...block, items: ["meds"] }],
        explanation: "I added unrelated equipment evidence from another album.",
      },
      { toolCallId: "z", messages: [] } as never,
    ),
  ).toMatchObject({ accepted: false });
  expect(context.getUpdate()?.nextSpec.blocks).toEqual([block]);
});
