import { expect, it, vi } from "vitest";
import { createCanvasContext } from "../createCanvasContext";
import type { CanvasRequest } from "../const";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
const request: CanvasRequest = {
  version: "canvas.v1",
  sessionId: "11111111-1111-4111-8111-111111111111",
  turnId: "22222222-2222-4222-8222-222222222222",
  baseRevision: 0,
  spec: { blocks: [] },
  pinnedIds: [],
  selectedIds: [],
  focusId: null,
};
const call = { toolCallId: "test", messages: [] } as never;
it("composes a source outside the curated catalog and rehydrates the exact pinned passage", async () => {
  const source = originalFixture(
    "vault:unexpected",
    "https://example.com/recording",
    "Background. ".repeat(100) +
      "Improvisation is a daily recording practice with unfinished ideas.",
  );
  const context = createCanvasContext(request, [source], vi.fn().mockReturnValue(1), []);
  const read = (await context.readSource.execute!(
    { sourceId: source.sourceId, focus: "improvisation daily recording" },
    call,
  )) as { evidenceId: string; canvasExcerpt: string };
  expect(read.canvasExcerpt).toContain("Improvisation");
  const spec = {
    blocks: [
      {
        id: "found",
        kind: "document" as const,
        title: "Recording practice",
        items: [read.evidenceId],
        span: 2 as const,
      },
    ],
  };
  expect(
    await context.composeCanvas.execute!(
      {
        ...spec,
        explanation: "I added the source passage. The evidence does not establish a date.",
      },
      call,
    ),
  ).toMatchObject({ accepted: true });
  const first = context.getUpdate()!;
  const next = createCanvasContext(
    { ...request, spec, pinnedIds: ["found"], baseRevision: 1 },
    [source],
    vi.fn(),
    [],
  );
  await next.readSource.execute!({ sourceId: source.sourceId, focus: "Background" }, call);
  expect(
    await next.composeCanvas.execute!(
      {
        ...spec,
        explanation: "I added the source passage. The evidence does not establish a date.",
      },
      call,
    ),
  ).toMatchObject({ accepted: true });
  expect(next.getUpdate()!.evidence).toEqual(first.evidence);
});
it("cannot rehydrate evidence belonging to an artist outside the loaded corpus", async () => {
  const spec = {
    blocks: [
      {
        id: "foreign",
        kind: "document" as const,
        title: "Other artist",
        items: ["vault:foreign::excerpt:0"],
        span: 1 as const,
      },
    ],
  };
  const context = createCanvasContext({ ...request, spec }, [], vi.fn(), []);
  expect(
    await context.composeCanvas.execute!(
      {
        ...spec,
        explanation: "I added the source passage. The evidence does not establish a date.",
      },
      call,
    ),
  ).toMatchObject({ accepted: false });
});
it("carries the completed explanation when the final allowed step is composition", async () => {
  const context = createCanvasContext(request, [], vi.fn());
  await context.composeCanvas.execute!(
    {
      blocks: [],
      explanation: "I cleared the canvas. Available sources do not establish the requested date.",
    },
    call,
  );
  expect(context.getUpdate()?.explanation).toContain("do not establish");
});
it("rejects empty and draft-only completion explanations at the tool boundary", async () => {
  const context = createCanvasContext(request, [], vi.fn());
  const schema = context.composeCanvas.inputSchema as import("zod").ZodType;
  expect(schema.safeParse({ blocks: [], explanation: "" }).success).toBe(false);
  expect(
    schema.safeParse({ blocks: [], explanation: "Need the archive PDF passage." }).success,
  ).toBe(false);
});
