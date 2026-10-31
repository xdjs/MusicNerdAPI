import { expect, it } from "vitest";
import { createEvidenceAnswerTools } from "../createEvidenceAnswerTools";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
it("writes literal structured context and separate citation metadata without markup or raw answer text", async () => {
  const text = "[Artist Doc] & <b>not HTML</b>\n\n[1] is source text, not our citation.";
  const source = originalFixture("s", "https://example.com/source", text);
  const writes: Record<string, unknown>[] = [];
  const state = createEvidenceAnswerTools({
    originals: [source],
    artistName: "Artist",
    signal: new AbortController().signal,
    reload: async () => [source],
    writer: { write: (x: Record<string, unknown>) => writes.push(x) } as never,
  });
  const call = { toolCallId: "t", messages: [], context: {} };
  await state.tools.searchSources.execute!({ query: "source" }, call);
  const read = (await state.tools.readSource.execute!({ sourceId: "s" }, call)) as {
    passageId: string;
  };
  await state.tools.selectPassage.execute!({ passageId: read.passageId }, call);
  expect(writes).toContainEqual({
    type: "data-evidence-passage",
    id: read.passageId,
    data: {
      text,
      citation: { sourceId: "1", url: source.url, title: "Saved source" },
      publishedAt: null,
      activityDate: null,
      retrievedAt: null,
    },
  });
  expect(writes.some(x => String(x.type).startsWith("text-"))).toBe(false);
});
