import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
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
const u = vi.hoisted(() => ({
  latest: vi.fn(),
  search: vi.fn(),
  read: vi.fn(),
  list: vi.fn(),
  findCurrent: vi.fn(),
  assertDocs: vi.fn(),
}));
vi.mock("@/lib/questionResearch/loadPublicLatestResearchOriginals", () => ({
  loadPublicLatestResearchOriginals: u.latest,
}));
vi.mock("@/lib/units/searchUnits", () => ({ searchUnits: u.search }));
vi.mock("@/lib/units/readUnits", () => ({ readUnits: u.read }));
vi.mock("@/lib/units/listArtistDocuments", () => ({ listArtistDocuments: u.list }));
vi.mock("@/lib/units/findCurrentDocuments", () => ({ findCurrentDocuments: u.findCurrent }));
vi.mock("@/lib/units/assertDocumentsCurrent", () => ({ assertDocumentsCurrent: u.assertDocs }));
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

it("keeps planning narration written before a tool call off the stream", async () => {
  m.model = new MockLanguageModelV4({
    doStream: [
      {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "plan" },
            { type: "text-delta" as const, id: "plan", delta: "Let me read the key sources." },
            { type: "text-end" as const, id: "plan" },
            {
              type: "tool-call" as const,
              toolCallId: "call-readSource",
              toolName: "readSource",
              input: JSON.stringify({ sourceId: "vault:1" }),
            },
            finish("tool-calls"),
          ],
        }),
      },
      textStep("Dutchyyy is on ", "Night Label [1]."),
    ],
  });
  const chunks = await chunksOf(await post(ask("What label is Dutchyyy on?")));
  const text = chunks
    .filter(c => c.type === "text-delta")
    .map(c => c.delta)
    .join("");
  expect(text).toBe("Dutchyyy is on Night Label [1].");
  expect(chunks.filter(c => c.type === "tool-input-available").map(c => c.toolName)).toEqual([
    "readSource",
  ]);
});

it("replays an earlier PDF answer only while the document is still published at the revision it read", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const pdf = (revision: string) => ({
    id,
    title: "timeline.pdf",
    url: "https://public.example/timeline.pdf",
    path: "a/timeline.pdf",
    size: 100,
    revision,
    claimId: "c1",
  });
  const conversation = {
    messages: [
      { id: "1", role: "user", parts: [{ type: "text", text: "What names?" }] },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "tool-readPdfSource",
            toolCallId: "c",
            state: "output-available",
            input: { sourceId: id },
            output: {
              sourceId: id,
              n: 1,
              title: "timeline.pdf",
              pages: 13,
              sha256: "x",
              revision: "v1",
            },
          },
          { type: "text", text: "Dutchy was the producer alias [1, p.1]." },
        ],
      },
      { id: "3", role: "user", parts: [{ type: "text", text: "Which years?" }] },
    ],
  };

  m.pdfLoad.mockResolvedValue([pdf("v1")]);
  let model = new MockLanguageModelV4({ doStream: [textStep("2012 to 2019.")] });
  m.model = model;
  await chunksOf(await post(conversation));
  let prompt = JSON.stringify(model.doStreamCalls[0].prompt);
  expect(prompt).toContain("Dutchy was the producer alias [1, p.1].");
  expect(prompt).toContain("Which years?");

  m.pdfLoad.mockResolvedValue([pdf("v2")]);
  model = new MockLanguageModelV4({ doStream: [textStep("Let me check.")] });
  m.model = model;
  await chunksOf(await post(conversation));
  prompt = JSON.stringify(model.doStreamCalls[0].prompt);
  expect(prompt).not.toContain("Dutchy was the producer alias");
  expect(prompt).toContain("Which years?");

  m.pdfLoad.mockResolvedValue([]);
  model = new MockLanguageModelV4({ doStream: [textStep("Let me check.")] });
  m.model = model;
  await chunksOf(await post(conversation));
  expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain(
    "Dutchy was the producer alias",
  );
});

describe("with CHAT_RETRIEVAL=units", () => {
  const uuid = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
  const doc = (id: number, url: string | null, sourceKind = "vault" as const) => ({
    sourceKind,
    sourceId: uuid(id),
    revision: `r${id}`,
    title: `Doc ${id}`,
    url,
  });
  const hit = (d: ReturnType<typeof doc>, locator: string, text: string) => ({
    sourceKind: d.sourceKind,
    sourceId: d.sourceId,
    sourceRevision: d.revision,
    unitIndex: 0,
    locator,
    title: d.title,
    url: d.url,
    text,
    score: 1,
  });
  const key = (d: ReturnType<typeof doc>) => `${d.sourceKind}:${d.sourceId}:${d.revision}`;

  beforeEach(() => {
    vi.stubEnv("CHAT_RETRIEVAL", "units");
    u.latest.mockResolvedValue([]);
    u.search.mockResolvedValue({ hits: [], weak: true });
    u.list.mockResolvedValue([]);
    u.findCurrent.mockResolvedValue(new Set());
    u.assertDocs.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never loads the whole corpus, offers exactly the six tools, caps output at 1500 tokens and sends the units instructions", async () => {
    const model = new MockLanguageModelV4({ doStream: [textStep("Hi.")] });
    m.model = model;
    const response = await post(ask("Who is this?"));
    expect(response.status).toBe(200);
    await chunksOf(response);
    expect(m.originals).not.toHaveBeenCalled();
    expect(u.latest).toHaveBeenCalledWith(artistId);
    const call = model.doStreamCalls[0];
    expect((call.tools ?? []).map(t => t.name).sort()).toEqual([
      "listDocuments",
      "readSource",
      "readUnits",
      "searchPassages",
      "searchSources",
      "webSearch",
    ]);
    expect(call.maxOutputTokens).toBe(1500);
    expect(call.prompt[0]).toEqual({
      role: "system",
      content: buildArtistChatInstructions("Dutchyyy", new Date(), "units"),
    });
    expect(m.pdfRead).not.toHaveBeenCalled();
  });

  it("numbers earlier answers' documents as they were and revalidates every registered document once per step", async () => {
    const earlierNoUrl = doc(1, null);
    const earlier = doc(2, "https://a.example/doc");
    const fresh = doc(3, "https://c.example/doc");
    u.findCurrent.mockResolvedValue(new Set([key(earlierNoUrl), key(earlier)]));
    u.search.mockResolvedValue({
      hits: [hit(earlier, "p.2", "Dutchy was the alias."), hit(fresh, "p.1", "Night Label.")],
      weak: false,
    });
    const model = new MockLanguageModelV4({
      doStream: [toolStep("searchPassages", { query: "alias" }), textStep("Dutchy [2, p.2].")],
    });
    m.model = model;
    const chunks = await chunksOf(
      await post({
        messages: [
          { id: "1", role: "user", parts: [{ type: "text", text: "What names?" }] },
          {
            id: "2",
            role: "assistant",
            parts: [
              {
                type: "tool-searchPassages",
                toolCallId: "c",
                state: "output-available",
                input: { query: "names" },
                output: {
                  results: [],
                  weak: false,
                  documents: [
                    { n: 1, ...earlierNoUrl },
                    { n: 2, ...earlier },
                  ],
                },
              },
              { type: "text", text: "Dutchy was the producer alias [1, p.1]." },
            ],
          },
          { id: "3", role: "user", parts: [{ type: "text", text: "Which alias first?" }] },
        ],
      }),
    );
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain(
      "Dutchy was the producer alias [1, p.1].",
    );
    expect(chunks.filter(c => c.type === "source-url").map(c => [c.sourceId, c.url])).toEqual([
      ["1", `musicnerd://vault/${uuid(1)}`],
      ["2", "https://a.example/doc"],
      ["3", "https://c.example/doc"],
    ]);
    const output = chunks.find(c => c.type === "tool-output-available").output;
    expect(output.results.map((r: { n: number }) => r.n)).toEqual([2, 3]);
    expect(u.search).toHaveBeenCalledWith(artistId, "alias", {
      names: ["Dutchyyy"],
      signal: expect.any(AbortSignal),
    });
    // One check before each of the two model steps, each with every document numbered so far.
    expect(model.doStreamCalls).toHaveLength(2);
    expect(u.assertDocs).toHaveBeenCalledTimes(2);
    const checked = u.assertDocs.mock.calls.map(([id, refs]) => [
      id,
      refs.map((r: { sourceId: string }) => r.sourceId),
    ]);
    expect(checked).toEqual([
      [artistId, [uuid(1), uuid(2)]],
      [artistId, [uuid(1), uuid(2), uuid(3)]],
    ]);
    expect(m.assertCurrent).not.toHaveBeenCalled();
  });

  it("stops before the next model forward when a numbered document is revoked", async () => {
    u.search.mockResolvedValue({ hits: [hit(doc(1, null), "p.1", "Text")], weak: false });
    u.assertDocs
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error("Source changed or is no longer public"));
    const model = new MockLanguageModelV4({
      doStream: [toolStep("searchPassages", { query: "label" }), textStep("Must not be delivered")],
    });
    m.model = model;
    const chunks = await chunksOf(await post(ask("What label?")));
    expect(model.doStreamCalls).toHaveLength(1);
    expect(chunks.some(c => c.type === "error")).toBe(true);
    expect(chunks.some(c => c.type === "text-delta")).toBe(false);
  });

  it("shares one 12,000-token read budget across the answer's reads", async () => {
    const d = doc(1, "https://a.example/doc");
    u.search.mockResolvedValue({ hits: [hit(d, "p.1", "Text")], weak: false });
    u.read.mockResolvedValue({
      revision: d.revision,
      units: [{ locator: "p.1", text: "Page one.", tokens: 7000 }],
      missing: [],
    });
    m.model = new MockLanguageModelV4({
      doStream: [
        toolStep("searchPassages", { query: "label" }),
        toolStep("readUnits", { n: 1 }),
        toolStep("readUnits", { n: 1, locators: ["p.1"] }),
        textStep("Night Label [1, p.1]."),
      ],
    });
    const chunks = await chunksOf(await post(ask("What label?")));
    const reads = chunks
      .filter(c => c.type === "tool-output-available")
      .slice(1)
      .map(c => c.output);
    expect(reads.map(r => [r.units.length, r.truncated])).toEqual([
      [1, false],
      [0, true],
    ]);
  });

  it("serves searchSources and readSource from the latest originals only", async () => {
    u.latest.mockResolvedValue([
      {
        ...originalFixture(
          "latest:spotify:album1",
          "https://open.spotify.com/album/fixture",
          "New album Cedar out now",
        ),
        publishedAt: "2026-10-01T00:00:00Z",
      },
    ]);
    m.model = new MockLanguageModelV4({
      doStream: [
        toolStep("searchSources", { query: "new album", retrieval: "latest" }),
        toolStep("readSource", { sourceId: "latest:spotify:album1" }),
        textStep("Cedar [1]."),
      ],
    });
    const chunks = await chunksOf(await post(ask("What is the newest release?")));
    const outputs = chunks.filter(c => c.type === "tool-output-available").map(c => c.output);
    expect(outputs[0].sources.map((s: { sourceId: string }) => s.sourceId)).toEqual([
      "latest:spotify:album1",
    ]);
    expect(outputs[1]).toMatchObject({ n: 1, text: "New album Cedar out now" });
    expect(chunks.filter(c => c.type === "source-url").map(c => c.url)).toEqual([
      "https://open.spotify.com/album/fixture",
    ]);
    expect(m.originals).not.toHaveBeenCalled();
  });

  it("numbers a new source above every number a kept earlier answer cited", async () => {
    u.latest.mockResolvedValue([
      {
        ...originalFixture(
          "latest:spotify:album1",
          "https://open.spotify.com/album/fixture",
          "New album Cedar out now",
        ),
        publishedAt: "2026-10-01T00:00:00Z",
      },
    ]);
    m.model = new MockLanguageModelV4({
      doStream: [
        toolStep("readSource", { sourceId: "latest:spotify:album1" }),
        textStep("Cedar [6]."),
      ],
    });
    const chunks = await chunksOf(
      await post({
        messages: [
          { id: "1", role: "user", parts: [{ type: "text", text: "Any tour?" }] },
          // A text-only earlier answer citing web results up to [5].
          { id: "2", role: "assistant", parts: [{ type: "text", text: "Yes [2][5]." }] },
          { id: "3", role: "user", parts: [{ type: "text", text: "Newest release?" }] },
        ],
      }),
    );
    const read = chunks.find(c => c.type === "tool-output-available").output;
    expect(read).toMatchObject({ n: 6 });
    expect(chunks.filter(c => c.type === "source-url").map(c => c.sourceId)).toEqual(["6"]);
  });
});
