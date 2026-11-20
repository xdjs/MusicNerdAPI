import { beforeEach, describe, expect, it, vi } from "vitest";
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
const u = vi.hoisted(() => ({
  latest: vi.fn(),
  search: vi.fn(),
  read: vi.fn(),
  list: vi.fn(),
  findCurrent: vi.fn(),
  assertDocs: vi.fn(),
  count: vi.fn(),
}));
vi.mock("@/lib/questionResearch/loadPublicLatestResearchOriginals", () => ({
  loadPublicLatestResearchOriginals: u.latest,
}));
vi.mock("@/lib/units/searchUnits", () => ({ searchUnits: u.search }));
vi.mock("@/lib/units/readUnits", () => ({ readUnits: u.read }));
vi.mock("@/lib/units/listArtistDocuments", () => ({ listArtistDocuments: u.list }));
vi.mock("@/lib/units/findCurrentDocuments", () => ({ findCurrentDocuments: u.findCurrent }));
vi.mock("@/lib/units/assertDocumentsCurrent", () => ({ assertDocumentsCurrent: u.assertDocs }));
vi.mock("@/lib/units/countDocumentUnits", () => ({ countDocumentUnits: u.count }));
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
  m.artist.mockResolvedValue({ id: artistId, name: "Dutchyyy" });
  m.visitor.mockResolvedValue("f".repeat(64));
  m.reserve.mockResolvedValue(undefined);
  m.originals.mockResolvedValue([
    originalFixture("vault:1", "https://label.example/a", "Dutchyyy signed to Night Label."),
    originalFixture("vault:2", "https://blog.example/b", "An interview about synthesizers."),
  ]);
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
  expect(u.latest).not.toHaveBeenCalled();
});

it("answers 503 when the stored sources cannot be read", async () => {
  u.latest.mockRejectedValue(new Error("db down"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = await post(ask("Who?"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "error",
    error: "Chat is temporarily unavailable. Please try again.",
  });
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
              toolCallId: "call-searchPassages",
              toolName: "searchPassages",
              input: JSON.stringify({ query: "label" }),
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
    "searchPassages",
  ]);
});

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
  u.latest.mockResolvedValue([]);
  u.search.mockResolvedValue({ hits: [], weak: true });
  u.list.mockResolvedValue([]);
  u.findCurrent.mockResolvedValue(new Set());
  u.assertDocs.mockResolvedValue(undefined);
  u.count.mockResolvedValue(new Map());
});

it("never loads the whole corpus, offers exactly the six tools, caps output at 1500 tokens and sends the instructions", async () => {
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
    content: buildArtistChatInstructions("Dutchyyy", new Date()),
  });
});

it("numbers earlier answers' documents as they were and revalidates every registered document once per step", async () => {
  const earlierNoUrl = doc(1, null);
  const earlier = doc(2, "https://a.example/doc");
  const fresh = doc(3, "https://c.example/doc");
  u.findCurrent.mockResolvedValue(new Set([key(earlierNoUrl), key(earlier)]));
  u.count.mockResolvedValue(
    new Map([
      [`vault:${uuid(2)}`, 13],
      [`vault:${uuid(3)}`, 1],
    ]),
  );
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
  // Each listed document says how many of its units the search showed, out of its total.
  expect(
    output.documents.map((d: { n: number; units: number; shown: number }) => [
      d.n,
      d.units,
      d.shown,
    ]),
  ).toEqual([
    [2, 13, 1],
    [3, 1, 1],
  ]);
  expect(u.count).toHaveBeenCalledOnce();
  expect(u.count).toHaveBeenCalledWith(artistId, [
    { sourceKind: "vault", sourceId: uuid(2) },
    { sourceKind: "vault", sourceId: uuid(3) },
  ]);
  // The first search runs the user's question and the model's query as two separate searches.
  for (const asked of ["Which alias first?", "alias"])
    expect(u.search).toHaveBeenCalledWith(artistId, asked, {
      names: ["Dutchyyy"],
      signal: expect.any(AbortSignal),
    });
  expect(u.search).toHaveBeenCalledTimes(2);
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

it("shares one 36,000-token read budget across the answer's reads", async () => {
  const d = doc(1, "https://a.example/doc");
  u.search.mockResolvedValue({ hits: [hit(d, "p.1", "Text")], weak: false });
  u.read.mockResolvedValue({
    revision: d.revision,
    units: [{ locator: "p.1", text: "Page one.", tokens: 20000 }],
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

it("searches with no names, never the fallback, when the artist has no name", async () => {
  m.artist.mockResolvedValue({ id: artistId, name: null });
  m.model = new MockLanguageModelV4({
    doStream: [toolStep("searchPassages", { query: "alias" }), textStep("No.")],
  });
  await chunksOf(await post(ask("Any alias?")));
  for (const asked of ["Any alias?", "alias"])
    expect(u.search).toHaveBeenCalledWith(artistId, asked, {
      names: [],
      signal: expect.any(AbortSignal),
    });
});

describe("followUp", () => {
  // The question's search and the query's search find different documents.
  const searchByAsked = () => {
    const q = doc(1, "https://q.example/doc");
    const k = doc(2, "https://k.example/doc");
    u.count.mockResolvedValue(new Map());
    u.search.mockImplementation(async (_artist: string, asked: string) => ({
      hits: [
        asked === "alias" ? hit(k, "p.1", "From the query.") : hit(q, "p.1", "From the question."),
      ],
      weak: false,
    }));
  };
  const firstResult = async (body: unknown) => {
    m.model = new MockLanguageModelV4({
      doStream: [toolStep("searchPassages", { query: "alias" }), textStep("Ok.")],
    });
    const chunks = await chunksOf(await post(body));
    return chunks
      .find(c => c.type === "tool-output-available")
      .output.results.map((r: { passage: string }) => r.passage);
  };

  it("leads with the question's hits on a first question", async () => {
    searchByAsked();
    expect(await firstResult(ask("Any alias?"))).toEqual(["From the question.", "From the query."]);
  });

  it("leads with the model's query when an earlier user message exists", async () => {
    searchByAsked();
    expect(
      await firstResult({
        messages: [
          { id: "1", role: "user", parts: [{ type: "text", text: "Who is this?" }] },
          { id: "2", role: "assistant", parts: [{ type: "text", text: "An artist." }] },
          { id: "3", role: "user", parts: [{ type: "text", text: "Any alias?" }] },
        ],
      }),
    ).toEqual(["From the query.", "From the question."]);
  });
});
