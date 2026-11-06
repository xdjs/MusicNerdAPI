import { getChatCorpusFingerprint } from "@/lib/chat/getChatCorpusFingerprint";
import { beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { originalFixture } from "./originalFixture";

const m = vi.hoisted(() => ({
  model: undefined as unknown,
  assertCurrent: vi.fn(),
  artist: vi.fn(),
  visitor: vi.fn(),
  reserve: vi.fn(),
  originals: vi.fn(),
  webSearch: vi.fn(),
  pdfLoad: vi.fn(),
  pdfRead: vi.fn(),
}));
vi.mock("ai", async importOriginal => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    // The real SDK loop, on a scripted model instead of the gateway.
    streamText: (options: Parameters<typeof actual.streamText>[0]) =>
      actual.streamText({ ...options, model: m.model as never }),
  };
});
vi.mock("@/lib/sourcePublication/assertPublicSourceCurrent", () => ({
  assertPublicSourceCurrent: m.assertCurrent,
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: m.visitor,
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.originals,
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.webSearch }));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.pdfLoad }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.pdfRead }));
const { postArtistChatHandler } = await import("@/lib/chat/postArtistChatHandler");

const artistId = "11111111-1111-4111-8111-111111111111";
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const finish = (unified: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified, raw: undefined },
  usage,
});
const toolStep = (toolName: string, input: object) => ({
  stream: simulateReadableStream({
    chunks: [
      {
        type: "tool-call" as const,
        toolCallId: `call-${toolName}`,
        toolName,
        input: JSON.stringify(input),
      },
      finish("tool-calls"),
    ],
  }),
});
const textStep = (...deltas: string[]) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: "text-start" as const, id: "t" },
      ...deltas.map(delta => ({ type: "text-delta" as const, id: "t", delta })),
      { type: "text-end" as const, id: "t" },
      finish("stop"),
    ],
  }),
});
const post = (body: unknown, id = artistId) =>
  postArtistChatHandler(
    new Request(`https://api.example/api/artist/${id}/chat`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    id,
  );
const ask = (text: string) => ({
  messages: [{ id: "1", role: "user", parts: [{ type: "text", text }] }],
});
/** The SSE `data:` chunks of a UI message stream. */
async function chunksOf(response: Response) {
  return (await response.text())
    .split("\n")
    .filter(line => line.startsWith("data: ") && line !== "data: [DONE]")
    .map(line => JSON.parse(line.slice(6)));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.assertCurrent.mockReset().mockResolvedValue(undefined);
  m.pdfLoad.mockResolvedValue([]);
  m.artist.mockResolvedValue({ id: artistId, name: "Dutchyyy" });
  m.visitor.mockResolvedValue("f".repeat(64));
  m.reserve.mockResolvedValue(undefined);
  m.originals.mockResolvedValue([
    originalFixture("vault:1", "https://label.example/a", "Dutchyyy signed to Night Label."),
    originalFixture("vault:2", "https://blog.example/b", "An interview about synthesizers."),
  ]);
});

it("streams tool steps, a source-url per read source and text citing it", async () => {
  m.model = new MockLanguageModelV4({
    doStream: [
      toolStep("searchSources", { query: "label" }),
      toolStep("readSource", { sourceId: "vault:1" }),
      textStep("Dutchyyy is on ", "Night Label [1]."),
    ],
  });
  const response = await post(ask("What label is Dutchyyy on?"));
  expect(response.status).toBe(200);
  expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const chunks = await chunksOf(response);
  const types = chunks.map(c => c.type);
  expect(types).toContain("tool-input-available");
  expect(types).toContain("tool-output-available");
  expect(chunks.filter(c => c.type === "tool-input-available").map(c => c.toolName)).toEqual([
    "searchSources",
    "readSource",
  ]);
  const sources = chunks.filter(c => c.type === "source-url");
  expect(sources).toEqual([
    { type: "source-url", sourceId: "1", url: "https://label.example/a", title: "label.example" },
  ]);
  const text = chunks
    .filter(c => c.type === "text-delta")
    .map(c => c.delta)
    .join("");
  expect(text).toBe("Dutchyyy is on Night Label [1].");
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map(match => match[1]);
  for (const n of cited) expect(sources.map(s => s.sourceId)).toContain(n);
  // The source part arrives before the answer that cites it.
  expect(types.indexOf("source-url")).toBeLessThan(types.indexOf("text-delta"));
  expect(m.reserve).toHaveBeenCalledWith(artistId, "f".repeat(64));
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("sends the model the artist's instructions and the conversation", async () => {
  const model = new MockLanguageModelV4({ doStream: [textStep("Hi.")] });
  m.model = model;
  await chunksOf(await post(ask("Who is this?")));
  const prompt = model.doStreamCalls[0].prompt;
  expect(prompt[0].role).toBe("system");
  expect(JSON.stringify(prompt[0].content)).toContain("Dutchyyy");
  expect(prompt.at(-1)).toMatchObject({
    role: "user",
    content: [{ type: "text", text: "Who is this?" }],
  });
});

it("asks the model for low effort, so the answer starts sooner", async () => {
  const model = new MockLanguageModelV4({ doStream: [textStep("Hi.")] });
  m.model = model;
  await chunksOf(await post(ask("Who is this?")));
  expect(model.doStreamCalls[0].providerOptions).toEqual({ anthropic: { effort: "low" } });
});

it("answers for an artist without stored sources, citing a web result", async () => {
  m.originals.mockResolvedValue([]);
  m.webSearch.mockResolvedValue([{ url: "https://web.example/", title: "Web", snippet: "s" }]);
  m.model = new MockLanguageModelV4({
    doStream: [
      toolStep("searchSources", { query: "label" }),
      toolStep("webSearch", { query: "Dutchyyy label" }),
      textStep("My saved sources don't say; the web says Night Label [1]."),
    ],
  });
  const chunks = await chunksOf(await post(ask("What label?")));
  expect(chunks.filter(c => c.type === "source-url")).toEqual([
    { type: "source-url", sourceId: "1", url: "https://web.example/", title: "Web" },
  ]);
  expect(chunks.some(c => c.type === "text-delta")).toBe(true);
});

it("answers 400 for an invalid body before any lookup", async () => {
  const response = await post({ messages: [] });
  expect(response.status).toBe(400);
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.reserve).not.toHaveBeenCalled();
});

it("answers 404 for an unknown artist without spending the allowance", async () => {
  m.artist.mockRejectedValue(new KnowledgeError("not_found", 404, "Artist unavailable"));
  const response = await post(ask("Who?"));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ status: "error", error: "Artist not found" });
  expect(m.reserve).not.toHaveBeenCalled();
});

it("answers 404 for an id that is not a uuid", async () => {
  const response = await post(ask("Who?"), "not-an-id");
  expect(response.status).toBe(404);
  expect(m.artist).not.toHaveBeenCalled();
});

it("answers a 429 when the hourly allowance is spent", async () => {
  m.reserve.mockRejectedValue(
    Object.assign(new Error("limit"), {
      status: 429,
      code: "visitor_question_quota",
      retryAfterSeconds: 120,
      resetAt: "2026-10-27T13:00:00.000Z",
    }),
  );
  const response = await post(ask("Who?"));
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("120");
  expect(response.headers.get("X-MusicNerd-Quota")).toBe("true");
  expect(await response.json()).toEqual({
    status: "error",
    code: "visitor_question_quota",
    error: "You've reached your question limit for this hour. Try again in 2 minutes.",
    retryAfterSeconds: 120,
    resetAt: "2026-10-27T13:00:00.000Z",
  });
  expect(m.originals).not.toHaveBeenCalled();
});

it("answers 503 when the stored sources cannot be read", async () => {
  m.originals.mockRejectedValue(new Error("db down"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await post(ask("Who?"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "error",
    error: "Chat is temporarily unavailable. Please try again.",
  });
});

it("streams the newest saved Instagram evidence and its matching citation through the real SDK loop", async () => {
  const dated = (
    id: string,
    publishedAt: string | null,
    text: string,
    url = `https://www.instagram.com/p/${id}/`,
  ) => ({
    ...originalFixture(id, url, text),
    publishedAt,
  });
  m.artist.mockResolvedValue({ id: artistId, name: "Pete Rango" });
  m.originals.mockResolvedValue([
    ...Array.from({ length: 10 }, (_, i) =>
      dated(`old${i}`, "2026-01-01T00:00:00Z", "Latest recent Instagram news"),
    ),
    dated("fwb", "2026-09-25T00:00:00Z", "FWB Fest was wonderful"),
    dated(
      "spotify",
      "2026-10-01T00:00:00Z",
      "A newer album",
      "https://open.spotify.com/album/fixture",
    ),
    dated("future", "2099-01-01T00:00:00Z", "Future post"),
    dated("undated", null, "No date"),
  ]);
  const model = new MockLanguageModelV4({
    doStream: [
      toolStep("searchSources", {
        query: "latest Instagram",
        retrieval: "latest",
        platform: "instagram",
      }),
      toolStep("readSource", { sourceId: "fwb" }),
      textStep(
        "The newest Instagram post in the saved sources is dated September 25, 2026, about FWB Fest [1].",
      ),
    ],
  });
  m.model = model;
  const response = await post(ask("What is Pete Rango's latest Instagram post?"));
  expect(response.status).toBe(200);
  const chunks = await chunksOf(response);
  const outputs = chunks.filter(c => c.type === "tool-output-available").map(c => c.output);
  expect(outputs[0].sources[0]).toMatchObject({
    sourceId: "fwb",
    publishedAt: "2026-09-25T00:00:00Z",
  });
  expect(outputs[0].sources.every((s: { url: string }) => s.url.includes("instagram.com"))).toBe(
    true,
  );
  expect(outputs[0].coverage).toContain("stored");
  expect(outputs[1]).toMatchObject({
    n: 1,
    url: "https://www.instagram.com/p/fwb/",
    text: "FWB Fest was wonderful",
    publishedAt: "2026-09-25T00:00:00Z",
  });
  expect(chunks.filter(c => c.type === "source-url")).toEqual([
    {
      type: "source-url",
      sourceId: "1",
      url: "https://www.instagram.com/p/fwb/",
      title: "instagram.com",
    },
  ]);
  expect(
    chunks
      .filter(c => c.type === "text-delta")
      .map(c => c.delta)
      .join(""),
  ).toContain("[1]");
  expect(model.doStreamCalls).toHaveLength(3);
  expect(m.originals).toHaveBeenCalledTimes(1);
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("passes selected original PDF bytes through the real SDK model loop, never through client tool output", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  m.pdfLoad.mockResolvedValue([
    {
      id,
      title: "archive.pdf",
      url: "https://public.example/archive.pdf",
      path: "a/archive.pdf",
      size: 100,
      revision: "v1",
      claimId: "c1",
    },
  ]);
  m.pdfRead.mockResolvedValue({
    bytes: Buffer.from("%PDF-synthetic-original"),
    pages: 2,
    hash: "sha",
  });
  const model = new MockLanguageModelV4({
    doStream: [
      toolStep("searchPdfSources", { query: "archive.pdf" }),
      toolStep("readPdfSource", { sourceId: id }),
      textStep("The document says Cedar ([1], page 2)."),
    ],
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("What does archive.pdf say?")));
  expect(model.doStreamCalls).toHaveLength(3);
  const prompt = JSON.stringify(model.doStreamCalls[2].prompt);
  expect(prompt).toContain("application/pdf");
  expect(prompt).toContain(Buffer.from("%PDF-synthetic-original").toString("base64"));
  expect(JSON.stringify(chunks)).not.toContain(
    Buffer.from("%PDF-synthetic-original").toString("base64"),
  );
  expect(chunks.filter(c => c.type === "source-url")).toMatchObject([
    { url: "https://public.example/archive.pdf" },
  ]);
  expect(m.pdfRead).toHaveBeenCalledTimes(1);
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("reads an explicitly named original in one tool call and two real SDK steps without exposing bytes", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  m.pdfLoad.mockResolvedValue([
    {
      id,
      title: "archive.pdf",
      url: "https://public.example/archive.pdf",
      path: "a/archive.pdf",
      size: 100,
      revision: "v1",
      claimId: "c1",
    },
  ]);
  m.pdfRead.mockResolvedValue({
    bytes: Buffer.from("%PDF-synthetic-original"),
    pages: 2,
    hash: "sha",
  });
  const model = new MockLanguageModelV4({
    doStream: [
      toolStep("readNamedPdf", { filename: "archive.pdf" }),
      textStep("The document says Cedar ([1], page 2)."),
    ],
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("What does archive.pdf say?")));
  expect(model.doStreamCalls).toHaveLength(2);
  const prompt = JSON.stringify(model.doStreamCalls[1].prompt);
  expect(prompt).toContain("application/pdf");
  expect(prompt).toContain(Buffer.from("%PDF-synthetic-original").toString("base64"));
  expect(JSON.stringify(chunks)).not.toContain(
    Buffer.from("%PDF-synthetic-original").toString("base64"),
  );
  expect(chunks.filter(c => c.type === "source-url")).toMatchObject([
    { url: "https://public.example/archive.pdf" },
  ]);
  expect(m.pdfRead).toHaveBeenCalledTimes(1);
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("carries a returned late-context locator through the real SDK read and streamed citation", async () => {
  const source = originalFixture(
    "late",
    "https://label.example/late",
    "Preface. ".repeat(1700) +
      "\n\nDub sessions\n\nQualification: this was a rehearsal, not a commercial release.\nDub recording notes.",
  );
  m.originals.mockResolvedValue([source]);
  let forwards = 0;
  const model = new MockLanguageModelV4({
    doStream: async params => {
      forwards++;
      if (forwards === 1) return toolStep("searchSources", { query: "dub" });
      if (forwards === 2) {
        const part = params.prompt
          .flatMap(p => (p.role === "tool" ? p.content : []))
          .find(p => p.type === "tool-result" && p.toolName === "searchSources") as {
          output: { value: string | { sources: { sourceId: string; locator: object }[] } };
        };
        const output =
          typeof part.output.value === "string" ? JSON.parse(part.output.value) : part.output.value;
        expect(output.sources[0].locator.start).toBeGreaterThan(12000);
        return toolStep("readSource", {
          sourceId: output.sources[0].sourceId,
          locator: output.sources[0].locator,
        });
      }
      expect(forwards).toBe(3);
      expect(JSON.stringify(params.prompt)).toContain("Qualification: this was a rehearsal");
      return textStep("A saved rehearsal account [1].");
    },
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("Tell me about the dub sessions.")));
  const output = chunks.find(
    c => c.type === "tool-output-available" && typeof c.output?.text === "string",
  )!.output;
  expect(output.text).toBe(source.text.slice(output.start, output.end));
  expect(output.text.length).toBeLessThanOrEqual(12000);
  expect(chunks.filter(c => c.type === "source-url")).toMatchObject([
    { sourceId: "1", url: source.url },
  ]);
  expect(chunks.findIndex(c => c.type === "source-url")).toBeLessThan(
    chunks.findIndex(c => c.type === "text-delta"),
  );
  expect(model.doStreamCalls).toHaveLength(3);
  for (const call of model.doStreamCalls) {
    expect(call.tools).toHaveLength(6);
    expect(call.toolChoice).toEqual({ type: "auto" });
  }
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("rereads on a follow-up, rejects a withdrawn prior source and restarts citation numbering", async () => {
  m.model = new MockLanguageModelV4({
    doStream: [toolStep("readSource", { sourceId: "vault:1" }), textStep("First fixture [1].")],
  });
  await chunksOf(await post(ask("First question")));
  m.originals.mockResolvedValue([
    originalFixture("vault:2", "https://other.example/b", "Second current fixture."),
  ]);
  const model = new MockLanguageModelV4({
    doStream: [
      toolStep("readSource", { sourceId: "vault:1" }),
      toolStep("readSource", { sourceId: "vault:2" }),
      textStep("Second fixture [1]."),
    ],
  });
  m.model = model;
  const chunks = await chunksOf(
    await post({
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "First question" }] },
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "First fixture [1]." },
            { type: "source-url", sourceId: "1", url: "https://label.example/a" },
          ],
        },
        { id: "u2", role: "user", parts: [{ type: "text", text: "What about the other source?" }] },
      ],
    }),
  );
  expect(model.doStreamCalls[0].prompt.map(p => p.role)).toEqual([
    "system",
    "user",
    "assistant",
    "user",
  ]);
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("https://label.example/a");
  const outputs = chunks.filter(c => c.type === "tool-output-available").map(c => c.output);
  expect(outputs[0]).toHaveProperty("error");
  expect(outputs[0]).not.toHaveProperty("text");
  expect(outputs[1]).toMatchObject({ n: 1, text: "Second current fixture." });
  expect(chunks.filter(c => c.type === "source-url")).toEqual([
    { type: "source-url", sourceId: "1", url: "https://other.example/b", title: "other.example" },
  ]);
  expect(m.reserve).toHaveBeenCalledTimes(2);
  expect(m.webSearch).not.toHaveBeenCalled();
});

it("stops before the next model forward when a read source publication is revoked", async () => {
  m.assertCurrent
    .mockResolvedValueOnce(undefined)
    .mockRejectedValue(new Error("Source changed or is no longer public"));
  const model = new MockLanguageModelV4({
    doStream: [toolStep("readSource", { sourceId: "vault:1" }), textStep("Must not be delivered")],
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("What label is Dutchyyy on?")));
  expect(model.doStreamCalls).toHaveLength(1);
  expect(chunks.some(c => c.type === "error")).toBe(true);
  expect(chunks.some(c => c.type === "text-delta")).toBe(false);
  expect(m.assertCurrent).toHaveBeenCalledTimes(2);
});

it("revalidates search previews, including before the next model forward", async () => {
  let checks = 0;
  m.assertCurrent.mockImplementation(async () => {
    if (++checks > 2) throw new Error("Source no longer public");
  });
  const model = new MockLanguageModelV4({
    doStream: [toolStep("searchSources", { query: "label" }), textStep("Must not be delivered")],
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("What label?")));
  expect(model.doStreamCalls).toHaveLength(1);
  expect(chunks.some(c => c.type === "error")).toBe(true);
  expect(chunks.some(c => c.type === "text-delta")).toBe(false);
});

it("observes the actual loaded corpus only through the trusted callback, never the UI stream", async () => {
  const originals = [
    originalFixture("vault:1", "https://label.example/a", "Exact current fixture"),
  ];
  m.originals.mockResolvedValue(originals);
  const observe = vi.fn();
  const execute = vi.fn(async () => ({ text: "" }));
  const response = await postArtistChatHandler(
    new Request("http://localhost/chat", {
      method: "POST",
      body: JSON.stringify(ask("What label?")),
    }),
    artistId,
    execute,
    observe,
  );
  const body = await response.text();
  expect(observe).toHaveBeenCalledWith({
    type: "data-chat-corpus-pin",
    data: { sha256: getChatCorpusFingerprint(originals) },
  });
  expect(body).not.toContain("data-chat-corpus-pin");
  expect(body).not.toContain(getChatCorpusFingerprint(originals));
  expect(execute).toHaveBeenCalledTimes(1);
  expect(m.originals).toHaveBeenCalledTimes(1);
});
it("a rejecting actual-corpus assertion stops before any stream/model execution", async () => {
  const execute = vi.fn(async () => ({ text: "unreachable" }));
  const response = await postArtistChatHandler(
    new Request("http://localhost/chat", {
      method: "POST",
      body: JSON.stringify(ask("What label?")),
    }),
    artistId,
    execute,
    () => {
      throw new Error("fixture corpus mismatch");
    },
  );
  expect(response.status).toBe(503);
  expect(execute).not.toHaveBeenCalled();
});
