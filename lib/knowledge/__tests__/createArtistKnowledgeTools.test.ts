import { beforeEach, describe, expect, it, vi } from "vitest";
import { createArtistKnowledgeTools } from "@/lib/knowledge/createArtistKnowledgeTools";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { queryArtistKnowledge } from "@/lib/knowledge/queryArtistKnowledge";
import { artistId, rawKnowledge } from "./fixtures";

const fetchMock = vi.fn();
const token = vi.fn(async () => "fixture-access-token");
const config = { apiOrigin: "https://api.example.org", artistId, getAccessToken: token };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  token.mockResolvedValue("fixture-access-token");
});

describe("createArtistKnowledgeTools", () => {
  it("bounds response bytes even when upstream omits Content-Length", async () => {
    fetchMock.mockResolvedValue(new Response(" ".repeat(128 * 1024 + 1)));
    await expect(
      createArtistKnowledgeTools(config).getArtistBrief.execute!(
        {},
        { toolCallId: "oversize", messages: [], context: {} },
      ),
    ).rejects.toThrow(/byte budget/i);
  });

  it("freezes host scope and encodes source IDs and search input", async () => {
    const original = { ...config };
    const scoped = createArtistKnowledgeTools(original);
    original.apiOrigin = "https://attacker.invalid";
    original.artistId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const snapshot = normalizeArtistKnowledge(rawKnowledge);
    fetchMock.mockResolvedValue(
      Response.json(
        queryArtistKnowledge(snapshot, {
          operation: "search",
          query: "drums & bass",
          maxChars: 1000,
          limit: 1,
        }),
      ),
    );
    await scoped.searchArtistKnowledge.execute!(
      { query: "drums & bass", maxChars: 1000, limit: 1 },
      { toolCallId: "scope", messages: [], context: {} },
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe(config.apiOrigin);
    expect(url.pathname).toContain(config.artistId);
    expect(url.searchParams.get("query")).toBe("drums & bass");
  });
  it("offers six read tools and gates the paid refresh capability on trusted host configuration", () => {
    const read = createArtistKnowledgeTools(config);
    expect(Object.keys(read)).toEqual([
      "getArtistBrief",
      "listArtistSources",
      "searchArtistKnowledge",
      "readArtistSource",
      "getInterviewHistory",
      "getResearchStatus",
    ]);
    expect(Object.keys(createArtistKnowledgeTools({ ...config, enableResearch: true }))).toContain(
      "requestArtistResearch",
    );
  });
  it("calls the shared HTTP API with fresh user auth, a deadline, no cache and no redirects", async () => {
    const response = queryArtistKnowledge(normalizeArtistKnowledge(rawKnowledge), {
      operation: "brief",
    });
    fetchMock.mockImplementation(async () => Response.json(response));
    const tools = createArtistKnowledgeTools(config);
    const execute = tools.getArtistBrief.execute!;
    await expect(execute({}, { toolCallId: "one", messages: [], context: {} })).resolves.toEqual(
      response,
    );
    token.mockResolvedValue("fresh-token");
    await execute({}, { toolCallId: "two", messages: [], context: {} });
    expect(token).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`https://api.example.org/api/artist/${artistId}/knowledge/brief`);
    expect(options).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "Bearer fresh-token" },
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("rejects model attempts to change artist/origin/credentials before any network call", async () => {
    const tool = createArtistKnowledgeTools(config).getArtistBrief;
    await expect(
      tool.execute!(
        { artistId: "other", apiOrigin: "https://attacker.invalid", token: "forged" } as never,
        { toolCallId: "bad", messages: [], context: {} },
      ),
    ).rejects.toThrow(/input/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
  });
  it("validates response shape and never treats an upstream failure as an empty success", async () => {
    const execute = createArtistKnowledgeTools(config).getArtistBrief.execute!;
    fetchMock.mockResolvedValueOnce(Response.json({ status: "ok", name: "incomplete" }));
    await expect(execute({}, { toolCallId: "bad", messages: [], context: {} })).rejects.toThrow(
      /response/i,
    );
    fetchMock.mockResolvedValueOnce(new Response("private database error", { status: 503 }));
    await expect(execute({}, { toolCallId: "bad", messages: [], context: {} })).rejects.toThrow(
      /503/,
    );
  });
  it("forwards cancellation and declines missing auth", async () => {
    const controller = new AbortController();
    controller.abort();
    const execute = createArtistKnowledgeTools(config).getArtistBrief.execute!;
    await expect(
      execute(
        {},
        { toolCallId: "cancel", messages: [], context: {}, abortSignal: controller.signal },
      ),
    ).rejects.toThrow(/cancel|abort|timed/i);
    expect(fetchMock).not.toHaveBeenCalled();
    const missing = createArtistKnowledgeTools({ ...config, getAccessToken: async () => null });
    await expect(
      missing.getArtistBrief.execute!({}, { toolCallId: "auth", messages: [], context: {} }),
    ).rejects.toThrow(/signed in/i);
  });
  it("times out token lookup as well as network work", async () => {
    const tools = createArtistKnowledgeTools({
      ...config,
      timeoutMs: 100,
      getAccessToken: () => new Promise(() => {}),
    });
    await expect(
      tools.getArtistBrief.execute!({}, { toolCallId: "timeout", messages: [], context: {} }),
    ).rejects.toThrow(/timed|abort/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps the refresh result honest about existing cooldown/job behavior", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "ok", message: "Already running" }));
    const tool = createArtistKnowledgeTools({
      ...config,
      enableResearch: true,
    }).requestArtistResearch!;
    await expect(
      tool.execute!({}, { toolCallId: "refresh", messages: [], context: {} }),
    ).resolves.toEqual({ status: "ok", message: "Already running" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/research/refresh");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
  it("refuses credentialed origins and non-local HTTP origins", () => {
    expect(() =>
      createArtistKnowledgeTools({ ...config, apiOrigin: "https://user:secret@api.example.org" }),
    ).toThrow(/origin/i);
    expect(() =>
      createArtistKnowledgeTools({ ...config, apiOrigin: "http://api.example.org" }),
    ).toThrow(/origin/i);
    expect(() =>
      createArtistKnowledgeTools({ ...config, apiOrigin: "http://localhost:3000" }),
    ).not.toThrow();
  });
});
