import { describe, expect, it, vi } from "vitest";
import { createEvalBudgetFetch } from "@/lib/evals/createEvalBudgetFetch";

const request = (model = "anthropic/claude-sonnet-5.5", text = "question") => ({
  method: "POST",
  headers: { "ai-language-model-id": model },
  body: JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text }] }] }),
});
const gateway = "https://ai-gateway.vercel.sh/v4/ai/language-model";
describe("createEvalBudgetFetch", () => {
  it("carries prior reservations forward and rejects invalid balances", async () => {
    const send = vi.fn().mockResolvedValue(new Response("ok"));
    const guard = createEvalBudgetFetch(send, 104224);
    expect(guard.snapshot().reservedUsd).toBe(0.104224);
    await guard.fetch("https://api.tavily.com/search", {
      method: "POST",
      body: JSON.stringify({ query: "artist" }),
    });
    expect(guard.snapshot().reservedUsd).toBe(0.120224);
    await expect(createEvalBudgetFetch(send, 4999999).fetch(gateway, request())).rejects.toThrow(
      "exhausted",
    );
    for (const invalid of [-1, NaN, 0.1, 5000001])
      expect(() => createEvalBudgetFetch(send, invalid)).toThrow();
  });
  it("allows the SDK's Anthropic message-start metadata on later tool steps", async () => {
    const send = vi.fn().mockResolvedValue(new Response("ok"));
    const guard = createEvalBudgetFetch(send);
    const init = request();
    init.body = JSON.stringify({
      prompt: [
        {
          role: "assistant",
          content: [
            {
              type: "custom",
              kind: "anthropic.message_start",
              providerOptions: { anthropic: { id: "synthetic", model: "claude-sonnet-5-5" } },
            },
            {
              type: "tool-call",
              toolCallId: "t",
              toolName: "webSearch",
              input: { query: "artist" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "t",
              toolName: "webSearch",
              output: { type: "json", value: { results: [] } },
            },
          ],
        },
      ],
    });
    await guard.fetch(gateway, init);
    expect(send).toHaveBeenCalledTimes(1);
    expect(guard.snapshot().blocked).toBe(false);
  });
  it("guards the installed AI SDK Gateway transport without a real provider call", async () => {
    const { generateText } = await import("ai");
    const send = vi.fn().mockResolvedValue(new Response("denied", { status: 400 }));
    const guard = createEvalBudgetFetch(send);
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only-not-a-key");
    vi.stubGlobal("fetch", guard.fetch);
    try {
      await expect(
        generateText({ model: "anthropic/claude-sonnet-5.5", prompt: "test", maxRetries: 0 }),
      ).rejects.toThrow();
      expect(guard.snapshot().paidRequests).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it("reserves before sending, limits output, and counts even failed attempts", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    const guard = createEvalBudgetFetch(send);
    await expect(guard.fetch(gateway, request())).rejects.toThrow("offline");
    expect(JSON.parse(send.mock.calls[0][1].body).maxOutputTokens).toBe(2048);
    expect(guard.snapshot().paidRequests).toBe(1);
    expect(guard.snapshot().reservedUsd).toBeGreaterThan(0);
  });
  it("never sends a request whose reservation exceeds five dollars", async () => {
    const send = vi.fn().mockResolvedValue(new Response("ok"));
    const guard = createEvalBudgetFetch(send);
    for (let i = 0; i < 100; i++) await guard.fetch(gateway, request()).catch(() => {});
    expect(guard.snapshot().reservedUsd).toBeLessThanOrEqual(5);
    expect(guard.snapshot().blocked).toBe(true);
    expect(send.mock.calls.length).toBeLessThan(100);
  });
  it("rejects unknown models, multimodal input and unknown network destinations", async () => {
    const send = vi.fn();
    for (const [url, init] of [
      [gateway, request("unknown")],
      [
        gateway,
        {
          ...request(),
          body: JSON.stringify({
            prompt: [{ role: "user", content: [{ type: "file", data: "x" }] }],
          }),
        },
      ],
      ["https://api.anthropic.com/v1/messages", request()],
    ] as const) {
      await expect(createEvalBudgetFetch(send).fetch(url, init)).rejects.toThrow();
    }
    expect(send).not.toHaveBeenCalled();
  });
  it("reserves search credits and passes through Braintrust logging", async () => {
    const send = vi.fn().mockResolvedValue(new Response("ok"));
    const guard = createEvalBudgetFetch(send);
    await guard.fetch("https://api.tavily.com/search", {
      method: "POST",
      body: JSON.stringify({ query: "artist" }),
    });
    expect(guard.snapshot().reservedUsd).toBe(0.016);
    await guard.fetch("https://api.braintrust.dev/logs3", { method: "POST", body: "{}" });
    expect(guard.snapshot().paidRequests).toBe(1);
  });
});
