import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream, createGateway, streamText } from "ai";
import { runtime, setupFixture, ARTIST, SOURCE, DOCUMENTS, documentBytes } from "./runtime";
import { boundedFetch } from "./network";
import { ledger } from "./ledger";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { readChatPdf } from "@/lib/chatPdf/readChatPdf";
import { loadChatPdfs } from "@/lib/chatPdf/loadChatPdfs";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";
const originalFetch = globalThis.fetch;
const dir = mkdtempSync(join(tmpdir(), "pdfv2-"));
let checks = 0;
const check = (value: unknown) => {
  assert.ok(value);
  checks++;
};
const finish = (kind: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified: kind, raw: undefined },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
});
try {
  const budget = ledger(join(dir, "ledger.json"), "offline-manifest");
  for (let i = 0; i < 4; i++) {
    assert.equal(budget.reserve(`case-${i}`), i + 1);
    budget.finish(`case-${i}`, false);
  }
  assert.throws(() => budget.reserve("overflow"));
  assert.throws(() => budget.reserve("case-0"));
  checks += 2;
  const uncertain = ledger(join(dir, "uncertain.json"), "offline-manifest");
  uncertain.reserve("started");
  assert.throws(() => uncertain.reserve("replacement"));
  uncertain.finish("started", true, "timeout");
  assert.throws(() => uncertain.reserve("after-failure"));
  checks += 2;
  for (const extracted of [false, true]) {
    const fixture = await setupFixture(extracted);
    globalThis.fetch = boundedFetch(originalFetch, undefined);
    try {
      check((await loadChatPdfs(ARTIST)).length === 2);
      check((await loadChatPdfs(SOURCE)).length === 0);
      await fixture.client.exec("update artist_claims set status='rejected'");
      check((await loadChatPdfs(ARTIST)).length === 0);
      await fixture.client.exec(
        "update artist_claims set status='approved';update artist_vault_sources set status='pending'",
      );
      check((await loadChatPdfs(ARTIST)).length === 0);
      await fixture.client.exec(
        "update artist_vault_sources set status='approved';update artist_vault_sources set url='https://private.invalid/file.pdf'",
      );
      check((await loadChatPdfs(ARTIST)).length === 0);
      await fixture.close();
    } catch (e) {
      await fixture.close();
      throw e;
    }
    const fresh = await setupFixture(extracted);
    for (const source of await loadChatPdfs(ARTIST)) {
      const read = await readChatPdf(source);
      const doc = DOCUMENTS.find(d => d.id === source.id)!;
      check(read.pages === doc.pages && read.hash === doc.sha256);
    }
    runtime.fixtureReads = [];
    let step = 0;
    let suppliedFile = false;
    runtime.model = new MockLanguageModelV4({
      doStream: async options => {
        const json = JSON.stringify(options.prompt);
        if (step === 2) suppliedFile = json.includes("application/pdf");
        const tool = step === 0 ? "searchPdfSources" : "readPdfSource";
        const input =
          step === 0 ? { query: "dutch_discography_timeline.pdf" } : { sourceId: SOURCE };
        const chunks =
          step++ < 2
            ? [
                {
                  type: "tool-call" as const,
                  toolCallId: `call-${step}`,
                  toolName: tool,
                  input: JSON.stringify(input),
                },
                finish("tool-calls"),
              ]
            : [
                { type: "text-start" as const, id: "t" },
                {
                  type: "text-delta" as const,
                  id: "t",
                  delta: "Scripted offline answer [1], physical page 2.",
                },
                { type: "text-end" as const, id: "t" },
                finish("stop"),
              ];
        return { stream: simulateReadableStream<(typeof chunks)[number]>({ chunks }) };
      },
    });
    const response = await postArtistChatHandler(
      new Request(`https://fixture.invalid/api/artist/${ARTIST}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: "q",
              role: "user",
              parts: [{ type: "text", text: "Read dutch_discography_timeline.pdf." }],
            },
          ],
        }),
      }),
      ARTIST,
    );
    const body = await response.text();
    check(response.status === 200);
    check(body.includes("Scripted offline answer"));
    check(suppliedFile);
    check(runtime.fixtureReads.length === 1);
    check(runtime.fixtureReads[0].includes(SOURCE));
    check(!body.includes(documentBytes(SOURCE).toString("base64").slice(0, 100)));
    check(runtime.modelOptions.every(o => o.maxOutputTokens === 2048 && o.maxRetries === 0));
    const admissions = await fresh.client.query<{ n: number }>(
      "select count(*)::int as n from question_planning_admissions",
    );
    check(admissions.rows[0].n === 1);
    for (let i = 1; i < 30; i++) await reserveQuestionPlanning(ARTIST, "f".repeat(64));
    await assert.rejects(
      () => reserveQuestionPlanning(ARTIST, "f".repeat(64)),
      (e: unknown) => (e as { status: number }).status === 429,
    );
    checks++;
    await fresh.close();
    runtime.model = undefined;
  }
  // Exercise the installed Gateway serialization with a local fetch: no request leaves the process.
  const fixture = await setupFixture(false);
  const transport = ledger(join(dir, "transport.json"), "offline");
  transport.reserve("serialization");
  let sent = 0;
  const gateway = createGateway({
    apiKey: "offline-not-a-credential",
    fetch: boundedFetch(async () => {
      sent++;
      return new Response(JSON.stringify({ error: { message: "offline capture complete" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }, transport),
  });
  const result = streamText({
    onError: () => {},
    model: gateway("anthropic/claude-sonnet-5.5"),
    providerOptions: { anthropic: { effort: "low" } },
    prompt: [
      {
        role: "user",
        content: [
          { type: "text", text: "Read the original." },
          { type: "file", mediaType: "application/pdf", data: documentBytes(SOURCE) },
        ],
      },
    ],
  });
  for await (const _ of result.fullStream) {
    /* Expected local error response, not an external call. */
  }
  check(sent === 1);
  check(transport.read().modelRequests === 1);
  const timing = runtime.transport.at(-1)!;
  check(timing.fileParts === 1);
  check(timing.responseHeadersMs! >= timing.requestMs);
  check(timing.firstRawChunkMs! >= timing.responseHeadersMs!);
  await fixture.close();
  writeFileSync(
    "../pdf-chat-eval/acceptance-v2/harness-offline.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        documents: DOCUMENTS.map(d => ({ file: d.file, sha256: d.sha256, pages: d.pages })),
        boundary:
          "isolated PGlite rows, fixed fixture visitor digest, empty non-PDF corpus, local storage bytes; real handler/eligibility SQL/allowance SQL/SDK/reader",
        providerRequests: 0,
        modelQuality: "not tested; scripted model",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Offline harness checks passed: ${checks}; no external network or paid model calls.`);
} finally {
  runtime.model = undefined;
  globalThis.fetch = originalFetch;
  rmSync(dir, { recursive: true, force: true });
}
