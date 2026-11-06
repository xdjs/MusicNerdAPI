import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createGateway, simulateReadableStream, readUIMessageStream } from "ai";
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
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: m.artist,
}));
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
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
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
      ...deltas.map(delta => ({
        type: "text-delta" as const,
        id: "t",
        delta,
      })),
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

function selectedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(selectedIds);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.blocks))
      return record.blocks.flatMap(block =>
        block && typeof block === "object" && "id" in block && typeof block.id === "string"
          ? [block.id]
          : [],
      );
    return Object.values(record).flatMap(selectedIds);
  }
  if (typeof value === "string" && value.startsWith("{")) {
    try {
      return selectedIds(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}
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

it("candidate: automatically routes earliest requests through literal SDK output without a composer", async () => {
  m.originals.mockResolvedValue([
    originalFixture(
      "vault:1",
      "https://source.example/a",
      "Heading\nOriginal [footnote].\nQualification retained.",
    ),
  ]);
  let step = 0;
  const model = new MockLanguageModelV4({
    doStream: async options =>
      ++step === 1
        ? toolStep("readSource", { sourceId: "vault:1" })
        : textStep(JSON.stringify({ blocks: selectedIds(options.prompt) }) + '\n{"end":true}\n'),
  });
  m.model = model;
  const chunks = await chunksOf(await post(ask("What was the first album they made together?")));
  expect(chunks.filter(c => c.type === "data-attributed-passage").map(c => c.data.text)).toEqual([
    "Heading\nOriginal [footnote].\nQualification retained.",
  ]);
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe(
    "complete-transport",
  );
  expect(chunks.some(c => ["text-delta", "file", "reasoning-delta"].includes(c.type))).toBe(false);
  expect(model.doStreamCalls).toHaveLength(2);
  for (const call of model.doStreamCalls) {
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

it("candidate: unsupported reconciliation never reaches the affected UI stream", async () => {
  m.model = new MockLanguageModelV4({
    doStream: [textStep("It was their first full collaboration album.")],
  });
  const chunks = await chunksOf(await post(ask("What was the first album made together?")));
  expect(JSON.stringify(chunks)).not.toContain("first full collaboration");
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe("failed");
});

it("candidate: withdrawal after final selection prevents literal delivery", async () => {
  let checks = 0;
  m.assertCurrent.mockImplementation(async () => {
    if (++checks >= 3) throw new Error("withdrawn before emission");
  });
  let step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options =>
      ++step === 1
        ? toolStep("readSource", { sourceId: "vault:1" })
        : textStep(JSON.stringify({ blocks: selectedIds(options.prompt) }) + '\n{"end":true}\n'),
  });
  const chunks = await chunksOf(await post(ask("What was the first album?")));
  expect(chunks.some(c => c.type === "data-attributed-passage")).toBe(false);
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe("failed");
});

it("candidate: native PDF bytes reach the model but unverified PDF text is explicitly unavailable", async () => {
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
    doStream: [toolStep("readNamedPdf", { filename: "archive.pdf" }), textStep('{"end":true}\n')],
  });
  m.model = model;
  const chunks = await chunksOf(
    await post(ask("Which years did each alias appear in archive.pdf?")),
  );
  expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain(
    Buffer.from("%PDF-synthetic-original").toString("base64"),
  );
  expect(chunks.filter(c => c.type === "data-attributed-passage")).toHaveLength(0);
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data).toMatchObject({
    state: "unavailable",
    pdfTextUnavailable: true,
  });
  expect(JSON.stringify(chunks)).not.toContain(
    Buffer.from("%PDF-synthetic-original").toString("base64"),
  );
});

it("candidate: real Gateway serialization and client stream reader preserve typed passages with no network", async () => {
  const calls: Record<string, unknown>[] = [];
  const noNetwork = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("offline_test_network_blocked"));
  const fetchStub = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    const parts =
      calls.length === 1
        ? [
            {
              type: "tool-call",
              toolCallId: "read",
              toolName: "readSource",
              input: JSON.stringify({ sourceId: "vault:1" }),
            },
            finish("tool-calls"),
          ]
        : [
            {
              type: "file",
              mediaType: "image/png",
              data: {
                type: "data",
                data: Buffer.from("GENERATED_FILE_MUST_NOT_LEAK").toString("base64"),
              },
            },
            { type: "text-start", id: "select" },
            {
              type: "text-delta",
              id: "select",
              delta: JSON.stringify({ blocks: selectedIds(body.prompt) }) + '\n{"end":true}\n',
            },
            { type: "text-end", id: "select" },
            finish("stop"),
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
  try {
    const chunks = await chunksOf(await post(ask("What was the first album?")));
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(chunks)).not.toContain(
      Buffer.from("GENERATED_FILE_MUST_NOT_LEAK").toString("base64"),
    );
    for (const call of calls) {
      expect((call.tools as { name: string }[]).map(t => t.name).sort()).toEqual([
        "readNamedPdf",
        "readPdfSource",
        "readSource",
        "searchPdfSources",
        "searchSources",
        "webSearch",
      ]);
      expect(call.toolChoice).toEqual({ type: "auto" });
      expect(call.providerOptions).toEqual({ anthropic: { effort: "low" } });
    }
    const errors: unknown[] = [];
    let last;
    for await (const message of readUIMessageStream({
      stream: simulateReadableStream({ chunks }),
      onError: error => errors.push(error),
    }))
      last = message;
    expect(errors).toEqual([]);
    expect(last?.parts.filter(p => p.type === "data-attributed-passage")).toHaveLength(1);
    expect(last?.parts.some(p => p.type === "text")).toBe(false);
    expect(noNetwork).not.toHaveBeenCalled();
  } finally {
    noNetwork.mockRestore();
  }
});

it("candidate: affected follow-up retains navigation only and re-reads current source", async () => {
  let step = 0;
  const model = new MockLanguageModelV4({
    doStream: async options =>
      ++step === 1
        ? toolStep("readSource", { sourceId: "vault:1" })
        : textStep(JSON.stringify({ blocks: selectedIds(options.prompt) }) + '\n{"end":true}\n'),
  });
  m.model = model;
  const chunks = await chunksOf(
    await post({
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "What was the first album?" }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "data-attributed-passage",
              data: {
                version: 1,
                sourceId: "vault:1",
                revision: "a".repeat(64),
                text: "OLD_WITHDRAWN_PASSAGE",
                url: "https://old.invalid/private",
              },
            },
          ],
        },
        {
          id: "u2",
          role: "user",
          parts: [{ type: "text", text: "What about that source?" }],
        },
      ],
    }),
  );
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("navigation hints");
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("OLD_WITHDRAWN_PASSAGE");
  expect(chunks.filter(c => c.type === "data-attributed-passage")).toHaveLength(1);
  expect(m.assertCurrent).toHaveBeenCalled();
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
    {
      type: "source-url",
      sourceId: "1",
      url: "https://label.example/a",
      title: "label.example",
    },
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
    expect(call.providerOptions).toEqual({ anthropic: { effort: "low" } });
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
      expect(call.providerOptions).toEqual({ anthropic: { effort: "low" } });
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

it.each(["Which label?", "What was the first album?"])(
  "keeps the six-step ceiling through Gateway serialization without an extra verifier: %s",
  async question => {
    let forwards = 0;
    const fetchStub = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.providerOptions).toEqual({
        anthropic: { effort: "low" },
      });
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
    const chunks = await chunksOf(await post(ask(question)));
    expect(forwards).toBe(6);
    expect(chunks.some(c => c.type === "text-delta")).toBe(false);
    // This proves only the ceiling; exhausted research is not answer-quality success.
  },
);

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
  expect(model.doStreamCalls[0].providerOptions).toEqual({
    anthropic: { effort: "low" },
  });
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
    {
      type: "source-url",
      sourceId: "1",
      url: "https://web.example/",
      title: "Web",
    },
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
  expect(await response.json()).toEqual({
    status: "error",
    error: "Artist not found",
  });
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

it("candidate: evaluator sees uncited reads and typed passages separately", async () => {
  let step = 0;
  const model = new MockLanguageModelV4({
    doStream: async options => {
      step++;
      if (step === 1) return toolStep("readSource", { sourceId: "vault:1" });
      if (step === 2) {
        const value = toolStep("readSource", { sourceId: "vault:2" });
        return value;
      }
      return textStep(
        JSON.stringify({ blocks: selectedIds(options.prompt).slice(0, 1) }) + '\n{"end":true}\n',
      );
    },
  });
  // Distinct call IDs are required for exact capture identity.
  let call = 0;
  const base = model.doStream;
  model.doStream = async options => {
    const result = await base(options);
    const count = ++call;
    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            controller.enqueue(
              part.type === "tool-call" ? { ...part, toolCallId: `read-${count}` } : part,
            );
          },
        }),
      ),
    };
  };
  m.model = model;
  const turn = await chatStreamTurn({
    artistId,
    question: "What was the first album?",
  });
  expect(turn.error).toBeUndefined();
  expect(turn.answer).toBe("");
  expect(turn.attribution?.passages).toHaveLength(1);
  expect(turn.evidence).toHaveLength(2);
  expect(turn.capture?.reads).toHaveLength(2);
  expect(turn.capture?.reads.every(r => r.complete)).toBe(true);
  expect(turn.sources).toHaveLength(2);
  expect(turn.firstPassageMs).toBeDefined();
  const { prepareEvaluation } = await import("@/lib/evals/attributed/prepareEvaluation");
  const attributed = turn.attribution!;
  expect(attributed.state).toBe("complete-transport");
  const evaluation = {
    question: "What was the first album?",
    reference: "Attribute saved accounts without inventing reconciliation.",
    answerable: true,
    answer: turn.answer,
    sources: turn.sources,
    evidence: turn.evidence,
    capture: turn.capture,
    attributed: { ...attributed, state: "complete-transport" as const },
  };
  const prepared = prepareEvaluation(evaluation);
  expect(prepared.status).toBe("ready");
  if (prepared.status === "ready") {
    expect(prepared.payload.evidence).toHaveLength(2);
    expect(prepared.payload.attributed?.passages[0]).toEqual(attributed.passages[0]);
  }
  const forged = structuredClone(evaluation);
  forged.attributed.passages[0].text += " Invented addition.";
  expect(prepareEvaluation(forged)).toMatchObject({
    status: "unscored",
    reason: "Selected passage lacks exact server-issued captured block provenance.",
  });
});

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
  const turn = await chatStreamTurn({
    artistId,
    question: "When was the archive post published?",
  });
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
  expect(model.doStreamCalls[0].providerOptions).toEqual({
    anthropic: { effort: "low" },
  });
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

it("candidate: revalidates arbitrary-prefix source eligibility immediately before delivery", async () => {
  const source = originalFixture(
    "interview:one",
    "https://source.example/current",
    "Literal original first album account.",
  );
  let loads = 0;
  m.originals.mockImplementation(async () => (++loads < 4 ? [source] : []));
  let step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options =>
      ++step === 1
        ? toolStep("readSource", { sourceId: source.sourceId })
        : textStep(JSON.stringify({ blocks: selectedIds(options.prompt) }) + '\n{"end":true}\n'),
  });
  const chunks = await chunksOf(await post(ask("What was the first album?")));
  expect(chunks.some(c => c.type === "data-attributed-passage")).toBe(false);
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe("failed");
  expect(loads).toBeGreaterThanOrEqual(4);
});

it("candidate: search-only arbitrary-prefix exposure is rechecked before another model step", async () => {
  const source = originalFixture(
    "press:one",
    "https://source.example/current",
    "Dutchyyy first album original account.",
  );
  let loads = 0;
  m.originals.mockImplementation(async () => (++loads < 3 ? [source] : []));
  m.model = new MockLanguageModelV4({
    doStream: [toolStep("searchSources", { query: "first album" }), textStep('{"end":true}\n')],
  });
  const chunks = await chunksOf(await post(ask("What was the first album?")));
  expect((m.model as MockLanguageModelV4).doStreamCalls).toHaveLength(1);
  expect(chunks.some(c => c.type === "data-attributed-passage")).toBe(false);
  expect(loads).toBeGreaterThanOrEqual(3);
});

it("v3: eight search results and three selected blocks use one fresh check per boundary, with compact model output and full capture", async () => {
  const fullText = "Dutchyyy first album. " + "A".repeat(4940) + " Final qualification.";
  const corpus = Array.from({ length: 8 }, (_, i) =>
    originalFixture(
      `custom:${i}`,
      `https://source.example/${i}`,
      i === 0 ? fullText : `Dutchyyy first album related source ${i}.`,
    ),
  );
  m.originals.mockResolvedValue(corpus);
  const pdfModule = await import("@/lib/chatPdf/createChatPdfTools");
  const realPdfFactory = pdfModule.createChatPdfTools;
  const pdfCheck = vi.fn(async () => {});
  const factory = vi.spyOn(pdfModule, "createChatPdfTools").mockImplementation((...args) => {
    const tools = realPdfFactory(...args);
    return {
      ...tools,
      assertCurrent: async () => {
        await pdfCheck();
        await tools.assertCurrent();
      },
      assertRegistered: async selected => {
        await pdfCheck();
        await tools.assertRegistered(selected);
      },
    };
  });
  let step = 0;
  let modelView: Record<string, any> | undefined;
  const findView = (value: unknown): void => {
    if (typeof value === "string" && value.startsWith("{")) {
      try {
        findView(JSON.parse(value));
      } catch {}
    } else if (Array.isArray(value)) value.forEach(findView);
    else if (value && typeof value === "object") {
      const row = value as Record<string, any>;
      if (Array.isArray(row.blocks) && typeof row.text === "string") modelView = row;
      else Object.values(row).forEach(findView);
    }
  };
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      step++;
      if (step === 1) {
        expect(m.originals).toHaveBeenCalledTimes(1);
        return toolStep("searchSources", { query: "first album" });
      }
      if (step === 2) {
        // Initial load, one eight-result search check, one before-step check.
        expect(m.originals).toHaveBeenCalledTimes(3);
        expect(m.assertCurrent).toHaveBeenCalledTimes(16);
        return toolStep("readSource", { sourceId: "custom:0" });
      }
      expect(m.originals).toHaveBeenCalledTimes(5);
      expect(m.assertCurrent).toHaveBeenCalledTimes(32);
      findView(options.prompt);
      const ids = selectedIds(options.prompt);
      return textStep(
        JSON.stringify({ blocks: [ids[0], ids[1], ids.at(-1)] }) + '\n{"end":true}\n',
      );
    },
  });
  try {
    const turn = await chatStreamTurn({
      artistId,
      question: "What was the first album?",
    });
    expect(turn.error).toBeUndefined();
    expect(turn.attribution?.state).toBe("complete-transport");
    expect(turn.attribution?.passages).toHaveLength(3);
    // Every new boundary reloads, but selection and final validation each load
    // only once for all 8 exposed originals, rather than once per selected block.
    expect(m.originals).toHaveBeenCalledTimes(7);
    expect(m.assertCurrent).toHaveBeenCalledTimes(48);
    expect(pdfCheck).toHaveBeenCalledTimes(7);
    expect(modelView?.text).toBe(fullText);
    expect(Object.keys(modelView!.blocks[0]).sort()).toEqual([
      "contextIncomplete",
      "end",
      "id",
      "preview",
      "start",
    ]);
    expect(modelView).not.toHaveProperty("readId");
    expect(modelView).not.toHaveProperty("sha256");
    expect(turn.capture?.reads).toHaveLength(1);
    expect(turn.capture?.reads[0].complete).toBe(true);
    const capturedRead = turn.evidence![0];
    const capturedJSON = JSON.stringify(capturedRead);
    expect(capturedJSON).toContain("readSha256");
    expect(capturedJSON).toContain("bounded-read-context-v1");
    expect(capturedJSON).toContain(fullText);
    const { prepareEvaluation } = await import("@/lib/evals/attributed/prepareEvaluation");
    expect(
      prepareEvaluation({
        question: "What was the first album?",
        reference: "Retain qualifications.",
        answerable: true,
        answer: turn.answer,
        sources: turn.sources,
        evidence: turn.evidence,
        capture: turn.capture,
        attributed: { ...turn.attribution!, state: "complete-transport" },
      }).status,
    ).toBe("ready");
    // Same literal text, materially less repeated provider-facing metadata.
    expect(JSON.stringify(modelView).length).toBeLessThan(capturedJSON.length);
  } finally {
    factory.mockRestore();
  }
});

it.each(["List all aliases.", "Show the stage names.", "What were the earliest releases?"])(
  "v3: handler routes %s into the bounded selector",
  async question => {
    m.model = new MockLanguageModelV4({ doStream: textStep('{"end":true}\n') });
    const chunks = await chunksOf(await post(ask(question)));
    expect(chunks.some(c => c.type === "text-delta")).toBe(false);
    expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe(
      "unavailable",
    );
  },
);

function verifiedSyntheticPdf() {
  const source = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "aliases.pdf",
    url: "https://source.example/aliases.pdf",
    path: "synthetic/aliases.pdf",
    size: 32,
    revision: "2026-11-06 12:20:30.000+00:" + "a".repeat(32) + ":public",
    claimId: null,
  };
  const bytes = Buffer.from("%PDF-1.4 synthetic handler fixture");
  source.size = bytes.length;
  const hash = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
  const pages = Array.from({ length: 6 }, (_, i) => {
    const text = `Physical page ${i + 1}. Literal source context [note] and its nearby qualification.`;
    return { physicalPage: i + 1, text, sha256: hash(text) };
  });
  const manifest = {
    originalSha256: hash(bytes),
    physicalPages: pages.length,
    pages,
    extractor: "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1",
    extraction: {
      engine: "pdf-parse@1.1.4/pdfjs@1.10.100",
      algorithm: "pdf-text-items-y-lines-v1",
      coverage: "all-physical-pages-text-layer",
      emptyTextPages: [],
      visualTextCompleteness: "unverified",
    },
  };
  m.pdfLoad.mockResolvedValue([source]);
  m.pdfRead.mockResolvedValue({
    bytes,
    pages: pages.length,
    hash: hash(bytes),
    textManifest: manifest,
  });
  return { source, bytes, manifest };
}

it("v4: six PDF contexts traverse actual tools/SDK/registry/capture without raw bytes or prose reaching the public stream", async () => {
  const fixture = verifiedSyntheticPdf();
  let step = 0;
  let nativeSeen = false;
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      if (++step === 1) return toolStep("readNamedPdf", { filename: fixture.source.title });
      nativeSeen = JSON.stringify(options.prompt).includes("application/pdf");
      return textStep(JSON.stringify({ blocks: selectedIds(options.prompt) }) + '\n{"end":true}\n');
    },
  });
  const events: any[] = [];
  const turn = await chatStreamTurn(
    { artistId, question: "Which names did the musician use in aliases.pdf?" },
    undefined,
    {
      requestId: "synthetic-pdf-six",
      claim: () => {},
      record: (kind, value) => {
        if (kind === "ui-chunk") events.push(value);
      },
    },
  );
  expect(turn.error).toBeUndefined();
  expect(nativeSeen).toBe(true);
  expect(turn.attribution?.state).toBe("complete-transport");
  expect(turn.attribution?.passages).toHaveLength(6);
  expect(
    turn.attribution?.passages.every(
      p => p.kind === "pdf-page-text" && p.context === "pdf-page-context-v1" && p.contextIncomplete,
    ),
  ).toBe(true);
  expect(turn.evidence).toHaveLength(6);
  expect(turn.capture?.reads[0]).toMatchObject({
    tool: "readNamedPdf",
    complete: true,
    totalPages: 6,
    originalSha256: fixture.manifest.originalSha256,
  });
  expect(
    events.some(e =>
      ["file", "text-delta", "tool-output-available", "reasoning-delta"].includes(e.type),
    ),
  ).toBe(false);
  expect(JSON.stringify(events)).not.toContain(fixture.bytes.toString("base64"));
  const { prepareEvaluation } = await import("@/lib/evals/attributed/prepareEvaluation");
  expect(
    prepareEvaluation({
      question: "Which names?",
      reference: "Retain source contexts.",
      answerable: true,
      answer: turn.answer,
      sources: turn.sources,
      evidence: turn.evidence,
      capture: turn.capture,
      attributed: { ...turn.attribution!, state: "complete-transport" },
    }).status,
  ).toBe("ready");
});

it("v4: PDF follow-up strips prior literal text and reopens the same hash-bound physical-page context with full capture", async () => {
  const fixture = verifiedSyntheticPdf();
  let step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options =>
      ++step === 1
        ? toolStep("readNamedPdf", { filename: fixture.source.title })
        : textStep(
            JSON.stringify({ blocks: [selectedIds(options.prompt)[3]] }) + '\n{"end":true}\n',
          ),
  });
  const question = "Which names did the musician use in aliases.pdf?";
  const initial = await chatStreamTurn({ artistId, question });
  expect(initial.error).toBeUndefined();
  const selected = initial.attribution!.passages[0];
  const locator = {
    sourceId: selected.sourceId,
    revision: selected.revision,
    originalSha256: selected.originalSha256!,
    physicalPage: selected.physicalPage!,
    pageSha256: selected.pageSha256!,
    start: selected.start,
    end: selected.end,
    sha256: selected.sha256,
  };
  step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      if (++step === 1) {
        expect(JSON.stringify(options.prompt)).not.toContain("UNTRUSTED_PRIOR_LITERAL");
        expect(JSON.stringify(options.prompt)).toContain("readPdfSource");
        return toolStep("readPdfSource", {
          sourceId: fixture.source.id,
          locator,
        });
      }
      expect(JSON.stringify(options.prompt)).toContain("reopened");
      return textStep(
        JSON.stringify({ blocks: [selectedIds(options.prompt)[3]] }) + '\n{"end":true}\n',
      );
    },
  });
  const followup = "What about that passage?";
  const turn = await chatStreamTurn({
    artistId,
    question: followup,
    messages: [
      { id: "u1", role: "user", parts: [{ type: "text", text: question }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "data-attributed-passage",
            data: {
              version: 1,
              ...selected,
              text: "UNTRUSTED_PRIOR_LITERAL",
              url: "https://old-untrusted.example",
              title: "Untrusted old title",
            },
          },
        ],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: followup }] },
    ],
  });
  expect(turn.error).toBeUndefined();
  expect(turn.evidence).toHaveLength(6);
  expect(turn.capture?.reads[0].complete).toBe(true);
  expect(turn.attribution?.passages[0]).toMatchObject({
    physicalPage: selected.physicalPage,
    sha256: selected.sha256,
    text: selected.text,
    start: selected.start,
    end: selected.end,
  });
  expect(turn.attribution?.passages[0].id).not.toBe(selected.id);
});

it("v4: withdrawing a PDF after model input prevents selected literal output", async () => {
  const fixture = verifiedSyntheticPdf();
  let step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      if (++step === 1) return toolStep("readNamedPdf", { filename: fixture.source.title });
      m.pdfLoad.mockResolvedValue([]);
      return textStep(
        JSON.stringify({ blocks: [selectedIds(options.prompt)[0]] }) + '\n{"end":true}\n',
      );
    },
  });
  const chunks = await chunksOf(
    await post(ask("Which names did the musician use in aliases.pdf?")),
  );
  expect(chunks.some(c => c.type === "data-attributed-passage")).toBe(false);
  expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe("failed");
});

it("a failed tool attempt followed by a valid literal selection retains complete private capture", async () => {
  m.webSearch.mockRejectedValue(new Error("offline synthetic search failure"));
  let step = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      if (++step === 1) return toolStep("webSearch", { query: "Synthetic artist first album" });
      if (step === 2) return toolStep("readSource", { sourceId: "vault:1" });
      return textStep(
        JSON.stringify({ blocks: [selectedIds(options.prompt)[0]] }) + '\n{"end":true}\n',
      );
    },
  });
  const events: { kind: string; value: any }[] = [];
  const turn = await chatStreamTurn(
    { artistId, question: "What was the first album?" },
    undefined,
    {
      requestId: "recovered-synthetic",
      claim: () => {},
      record: (kind, value) => events.push({ kind, value }),
    },
  );
  expect(turn.error).toBeUndefined();
  expect(turn.attribution?.state).toBe("complete-transport");
  expect(turn.capture?.complete).toBe(true);
  expect(turn.capture?.reads).toHaveLength(1);
  expect(turn.capture?.reads[0].tool).toBe("readSource");
  expect(
    events.some(e => e.kind === "server-tool-event" && e.value.type === "tool-output-error"),
  ).toBe(true);
  expect(events.some(e => e.kind === "ui-chunk" && e.value.type === "tool-output-error")).toBe(
    false,
  );
  expect(m.webSearch).toHaveBeenCalledTimes(1);
});

it.each([undefined, "text/event-stream; musicnerd-attributed-text=12000"])(
  "negotiates one response limit through actual SDK and registry for Accept=%s",
  async accept => {
    const limit = accept ? 12000 : 6000;
    m.originals.mockResolvedValue([
      originalFixture("vault:cap", "https://source.example/cap", "A".repeat(5000)),
    ]);
    let step = 0;
    const model = new MockLanguageModelV4({
      doStream: async options => {
        const prompt = JSON.stringify(options.prompt);
        expect(prompt).toContain(`Use at most ${limit} literal UTF-16 text characters total`);
        if (++step === 1) return toolStep("readSource", { sourceId: "vault:cap" });
        expect(prompt).toContain(`within ${limit} literal UTF-16 text characters total`);
        return textStep(
          JSON.stringify({ blocks: selectedIds(options.prompt).slice(0, 3) }) + '\n{"end":true}\n',
        );
      },
    });
    m.model = model;
    const request = new Request(`https://api.example/api/artist/${artistId}/chat`, {
      method: "POST",
      headers: accept ? { Accept: accept } : {},
      body: JSON.stringify(ask("What was the first album?")),
    });
    const chunks = await chunksOf(await postArtistChatHandler(request, artistId));
    const selected = chunks.filter(c => c.type === "data-attributed-passage");
    expect(selected.reduce((n, p) => n + p.data.text.length, 0)).toBe(accept ? 6200 : 0);
    expect(chunks.filter(c => c.type === "data-attributed-status").at(-1).data.state).toBe(
      accept ? "complete-transport" : "failed",
    );
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls.every(call => call.tools?.length === 6)).toBe(true);
    expect(m.reserve).toHaveBeenCalledTimes(1);
  },
);
