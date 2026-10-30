import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { runtime, setupFixture, setFixtureDirectory, ARTIST } from "./runtime";
import { boundedFetch } from "./network";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
setFixtureDirectory(process.argv[2]);
const fixture = await setupFixture(false);
const old = globalThis.fetch;
globalThis.fetch = boundedFetch(old, undefined);
try {
  runtime.model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start" as const, id: "t" },
          { type: "text-delta" as const, id: "t", delta: "Scripted baseline cannot read the PDF." },
          { type: "text-end" as const, id: "t" },
          {
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: undefined },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 1, text: 1, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
  const response = await postArtistChatHandler(
    new Request(`https://fixture.invalid/api/artist/${ARTIST}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { id: "q", role: "user", parts: [{ type: "text", text: "Read the saved PDF." }] },
        ],
      }),
    }),
    ARTIST,
  );
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.ok(body.includes("Scripted baseline"));
  assert.equal(runtime.fixtureReads.length, 0);
  assert.ok(runtime.modelOptions.every(o => o.maxOutputTokens === 2048 && o.maxRetries === 0));
  const admissions = await fixture.client.query<{ n: number }>(
    "select count(*)::int as n from question_planning_admissions",
  );
  assert.equal(admissions.rows[0].n, 1);
  console.log(
    "Current-main baseline real handler, equal cap and actual isolated allowance SQL verified; no network.",
  );
} finally {
  runtime.model = undefined;
  globalThis.fetch = old;
  await fixture.close();
}
