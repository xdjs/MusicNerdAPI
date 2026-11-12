import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { streamText, type StreamTextOptions } from "@/lib/ai/streamText";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";

// Offline configuration proof only: no source reads, tool execution, or provider calls.
const m = vi.hoisted(() => ({ name: "Dutchyyy", external: vi.fn() }));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: async () => ({ name: m.name }),
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: async () => [],
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: async () => "offline-pin-regression",
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: async () => undefined,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: async () => [] }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.external }));
vi.mock("@/lib/sourcePublication/assertPublicSourceCurrent", () => ({
  assertPublicSourceCurrent: m.external,
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.external }));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["single", "pair"])(
  "binds %s manifest pins to its dated real handler and SDK schemas",
  async suite => {
    const manifest = JSON.parse(readFileSync(`evals/chat-${suite}-manifest.json`, "utf8"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${manifest.utcDate}T12:00:00.000Z`));
    m.name = manifest.artistName;
    m.external.mockClear();
    m.external.mockImplementation(() => {
      throw new Error("external_operation_forbidden");
    });
    vi.stubGlobal("fetch", m.external);
    let observed: StreamTextOptions | undefined;
    const capture = async () => {
      observed = undefined;
      const response = await postArtistChatHandler(
        new Request("http://localhost/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: `text/event-stream; musicnerd-attributed-text=${manifest.attributedTextCharacters}`,
          },
          body: JSON.stringify({
            messages: [
              {
                id: "offline-pin",
                role: "user",
                parts: [{ type: "text", text: manifest.question }],
              },
            ],
          }),
        }),
        manifest.artistId,
        async options => {
          observed = options;
          return { text: "" };
        },
      );
      await response.text();
      expect(response.status).toBe(200);
      expect(observed).toBeDefined();
      return observed!;
    };
    const options = await capture();
    expect(options.instructions).toContain(`Today is ${manifest.utcDate}.`);
    expect(options.instructions).toContain("For this alias-inventory request");
    expect(options.instructions).toContain(`${manifest.attributedTextCharacters} literal UTF-16`);
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 0, text: 0, reasoning: undefined },
              },
            },
          ],
        }),
      }),
    });
    await streamText({ ...options, model, writer: undefined, maxRetries: 0 });
    expect(model.doStreamCalls).toHaveLength(1);
    const pins = {
      instructionsSha256: hash(options.instructions),
      promptSha256: hash(options.prompt),
      toolSchemasSha256: hash(model.doStreamCalls[0].tools),
    };
    expect(pins).toEqual({
      instructionsSha256: manifest.instructionsSha256,
      promptSha256: manifest.promptSha256,
      toolSchemasSha256: manifest.toolSchemasSha256,
    });
    vi.setSystemTime(new Date(Date.now() + 86400000));
    const nextDay = await capture();
    expect(hash(nextDay.instructions)).not.toBe(pins.instructionsSha256);
    expect(hash(nextDay.prompt)).toBe(pins.promptSha256);
    expect(m.external).not.toHaveBeenCalled();
  },
);
