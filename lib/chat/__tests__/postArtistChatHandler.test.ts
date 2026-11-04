import { beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createGateway, simulateReadableStream } from "ai";
import { MODEL_CHAT } from "@/lib/ai/const";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { originalFixture } from "./originalFixture";

const m = vi.hoisted(() => ({
  model: undefined as unknown,
  artist: vi.fn(),
  visitor: vi.fn(),
  reserve: vi.fn(),
  originals: vi.fn(),
  webSearch: vi.fn(),
  pdfLoad: vi.fn(),
  pdfRead: vi.fn(),
  assertCurrent: vi.fn(),
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
vi.mock("@/lib/sourcePublication/assertPublicSourceCurrent", () => ({
  assertPublicSourceCurrent: m.assertCurrent,
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
  m.assertCurrent.mockReset().mockResolvedValue(undefined);
  vi.clearAllMocks();
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
  expect((m.model as MockLanguageModelV4).doStreamCalls).toHaveLength(3);
  for (const call of (m.model as MockLanguageModelV4).doStreamCalls) {
    expect(call.providerOptions).toEqual({ anthropic: { effort: "medium" } });
    expect(call.tools?.map(t => t.name).sort()).toEqual([
      "readNamedPdf",
      "readPdfSource",
      "readSource",
      "searchPdfSources",
      "searchSources",
      "webSearch",
    ]);
    expect(call.toolChoice).toEqual({ type: "auto" });
  }
});

it("serializes moderate effort and all six automatic tools on every real Gateway forward", async () => {
  const calls: Record<string, unknown>[] = [];
  const scripted = [
    [
      {
        type: "tool-call",
        toolCallId: "find",
        toolName: "searchSources",
        input: JSON.stringify({ query: "label" }),
      },
      finish("tool-calls"),
    ],
    [
      {
        type: "tool-call",
        toolCallId: "read",
        toolName: "readSource",
        input: JSON.stringify({ sourceId: "vault:1" }),
      },
      finish("tool-calls"),
    ],
    [
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "A scripted answer [1]." },
      { type: "text-end", id: "answer" },
      finish("stop"),
    ],
  ];
  const noNetwork = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("offline_test_network_blocked"));
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("https://offline-gateway.invalid/v4/ai/language-model");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("ai-language-model-id")).toBe(MODEL_CHAT);
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    expect(calls.length).toBeLessThanOrEqual(3);
    return new Response(
      scripted[calls.length - 1].map(part => `data: ${JSON.stringify(part)}\n\n`).join(""),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  m.model = createGateway({
    apiKey: "synthetic-offline-test",
    baseURL: "https://offline-gateway.invalid/v4/ai",
    fetch: fetchStub,
  }).languageModel(MODEL_CHAT);
  try {
    const chunks = await chunksOf(await post(ask("Which label?")));
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.providerOptions).toEqual({ anthropic: { effort: "medium" } });
      expect((call.tools as { name: string }[]).map(t => t.name).sort()).toEqual([
        "readNamedPdf",
        "readPdfSource",
        "readSource",
        "searchPdfSources",
        "searchSources",
        "webSearch",
      ]);
      expect(call.toolChoice).toEqual({ type: "auto" });
    }
    expect(JSON.stringify(calls[2].prompt)).toContain("Dutchyyy signed to Night Label.");
    expect(
      chunks
        .filter(c => c.type === "text-delta")
        .map(c => c.delta)
        .join(""),
    ).toBe("A scripted answer [1].");
    expect(noNetwork).not.toHaveBeenCalled();
    expect(m.assertCurrent).toHaveBeenCalled();
  } finally {
    noNetwork.mockRestore();
  }
});

it("keeps the six-step ceiling through Gateway serialization without an extra verifier", async () => {
  let forwards = 0;
  const fetchStub = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    expect(body.providerOptions).toEqual({ anthropic: { effort: "medium" } });
    const parts = [
      {
        type: "tool-call",
        toolCallId: `search-${++forwards}`,
        toolName: "searchSources",
        input: JSON.stringify({ query: "label" }),
      },
      finish("tool-calls"),
    ];
    return new Response(parts.map(part => `data: ${JSON.stringify(part)}\n\n`).join(""), {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  m.model = createGateway({
    apiKey: "synthetic-offline-test",
    baseURL: "https://offline-gateway.invalid/v4/ai",
    fetch: fetchStub,
  }).languageModel(MODEL_CHAT);
  const chunks = await chunksOf(await post(ask("Which label?")));
  expect(forwards).toBe(6);
  expect(chunks.some(c => c.type === "text-delta")).toBe(false);
  // This proves only the ceiling; exhausted research is not answer-quality success.
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

it("uses moderate effort for ordinary chat without adding a second generation", async () => {
  const model = new MockLanguageModelV4({ doStream: [textStep("Hi.")] });
  m.model = model;
  await chunksOf(await post(ask("Who is this?")));
  expect(model.doStreamCalls[0].providerOptions).toEqual({ anthropic: { effort: "medium" } });
  expect(model.doStreamCalls).toHaveLength(1);
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

const { chatStreamTurn } = await import("@/lib/evals/chatStreamTurn");

it("keeps model-visible source dates in eval evidence through the production handler and real SDK", async () => {
  m.originals.mockResolvedValue([
    {
      ...originalFixture("dated", "https://archive.example/post", "Preserving an archive."),
      publishedAt: "2024-09-19T00:24:56.000Z",
      activityDate: null,
      retrievedAt: "2026-10-17T02:35:26.550Z",
    },
  ]);
  const model = new MockLanguageModelV4({
    doStream: [
      toolStep("readSource", { sourceId: "dated" }),
      textStep("The post was published in September 2024 [1]."),
    ],
  });
  m.model = model;
  const turn = await chatStreamTurn({ artistId, question: "When was the archive post published?" });
  expect(turn.error).toBeUndefined();
  const packet = JSON.stringify(model.doStreamCalls[1].prompt);
  expect(packet).toContain("2024-09-19T00:24:56.000Z");
  expect(packet).toContain("2026-10-17T02:35:26.550Z");
  expect(turn.evidence?.[0]).toMatchObject({
    n: 1,
    url: "https://archive.example/post",
    publishedAt: "2024-09-19T00:24:56.000Z",
    activityDate: null,
    retrievedAt: "2026-10-17T02:35:26.550Z",
  });
  expect(model.doStreamCalls[0].providerOptions).toEqual({ anthropic: { effort: "medium" } });
  expect(model.doStreamCalls[0].temperature).toBeUndefined();
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Base every claim");
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
