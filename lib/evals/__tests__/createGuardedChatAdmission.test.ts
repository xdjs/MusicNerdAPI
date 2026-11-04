import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { MODEL_CHAT } from "@/lib/ai/const";
import { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";

// Exercise the real SDK model middleware directly; the application loop is covered separately.
const m = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/streamText", () => ({ streamText: m.stream }));
let dir: string;
let events: { kind: string; value: any }[];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const params = (text = "界🙂") => ({
  prompt: [{ role: "user" as const, content: [{ type: "text" as const, text }] }],
  maxOutputTokens: 1024,
});
// Admission charges the complete post-routing prepared request, including the recipient pin.
const bytes = (p: unknown) => {
  const value = p as Record<string, unknown>;
  return Buffer.byteLength(
    JSON.stringify({
      ...value,
      providerOptions: {
        ...((value.providerOptions ?? {}) as Record<string, unknown>),
        gateway: { only: ["anthropic"] },
      },
    }),
  );
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mn1424-admission-"));
  events = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network_forbidden");
    }),
  );
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(
  limits = {},
  record = (kind: string, value: unknown) => {
    events.push({ kind, value });
  },
) {
  const forward = vi.fn(async () => ({
    stream: new ReadableStream({
      start(c) {
        c.enqueue({
          type: "finish",
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
        });
        c.close();
      },
    }),
  }));
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: forward });
  const manifest = {
    version: 1,
    runId: "offline",
    modelId: MODEL_CHAT,
    promptSha256: hash(JSON.stringify("q")),
    instructionsSha256: hash("null"),
    toolLimits: {},
    maxToolExecutions: 12,
    maxCalls: 6,
    maxInputBytes: 128000,
    maxTotalInputBytes: 196608,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
    ...limits,
  };
  const raw = JSON.stringify(manifest),
    path = join(dir, "manifest.json");
  writeFileSync(path, raw);
  return {
    forward,
    execute: createGuardedChatExecution({
      manifestPath: path,
      manifestSha256: hash(raw),
      model,
      record,
    }),
  };
}
it.each(["per-call", "total"])(
  "admits exact %s byte boundary and rejects a subsequent overflow",
  async kind => {
    const p = params();
    const n = bytes(p);
    const { execute, forward } = setup(
      kind === "per-call" ? { maxInputBytes: n } : { maxTotalInputBytes: n },
    );
    m.stream.mockImplementation(async o => {
      await o.model.doStream(p);
      await o.model.doStream(kind === "per-call" ? params("界🙂x") : p);
      return { text: "unreachable" };
    });
    await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
    expect(forward).toHaveBeenCalledTimes(1);
    expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
      reason: kind === "per-call" ? "eval_input_limit" : "eval_total_input_limit",
      attemptedCall: 2,
      inputBytes: kind === "per-call" ? n + 1 : n,
      consumedInputBytes: n,
    });
    expect(Buffer.byteLength(JSON.stringify(p))).toBeGreaterThan(JSON.stringify(p).length);
    expect(n).toBeGreaterThan(Buffer.byteLength(JSON.stringify(p)));
  },
);
it("charges repeated cached prefixes in full without concurrent reservation races", async () => {
  const p = {
    ...params("repeated prefix"),
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  };
  const n = bytes(p);
  const { execute, forward } = setup({ maxTotalInputBytes: 2 * n });
  let release!: () => void;
  const gate = new Promise<void>(r => {
    release = r;
  });
  forward.mockImplementation(async () => {
    await gate;
    return {
      stream: new ReadableStream({
        start(c) {
          c.enqueue({
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
          });
          c.close();
        },
      }),
    };
  });
  m.stream.mockImplementation(async o => {
    const calls = [o.model.doStream(p), o.model.doStream(p), o.model.doStream(p)];
    release();
    const settled = await Promise.allSettled(calls);
    expect(settled.filter(x => x.status === "fulfilled")).toHaveLength(2);
    throw new Error("expected rejected third admission");
  });
  await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
  expect(forward).toHaveBeenCalledTimes(2);
  expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
    attemptedCall: 3,
    inputBytes: n,
    consumedInputBytes: n * 2,
    remainingInputBytes: 0,
  });
});
it("does not refund a failed forward", async () => {
  const p = params(),
    n = bytes(p);
  const { execute, forward } = setup({ maxTotalInputBytes: n });
  forward.mockRejectedValue(new Error("uncertain provider failure"));
  m.stream.mockImplementation(async o => {
    await expect(o.model.doStream(p)).rejects.toThrow("uncertain provider failure");
    await o.model.doStream(p);
    return { text: "unreachable" };
  });
  await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
  expect(forward).toHaveBeenCalledTimes(1);
  expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
    consumedInputBytes: n,
    remainingInputBytes: 0,
  });
});
it("failed input capture retains reservation and blocks every forward", async () => {
  const p = params(),
    n = bytes(p);
  const { execute, forward } = setup({}, (kind, value) => {
    if (kind === "model-input") throw new Error("sink failed");
    events.push({ kind, value });
  });
  m.stream.mockImplementation(async o => {
    await expect(o.model.doStream(p)).rejects.toThrow();
    await o.model.doStream(p);
    return { text: "unreachable" };
  });
  await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
  expect(forward).not.toHaveBeenCalled();
  expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
    reason: "eval_capture_write",
    consumedInputBytes: n,
    calls: 1,
  });
});
it("retains the six-call bound", async () => {
  const { execute, forward } = setup();
  m.stream.mockImplementation(async o => {
    for (let i = 0; i < 7; i++) await o.model.doStream(params());
    return { text: "unreachable" };
  });
  await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
  expect(forward).toHaveBeenCalledTimes(6);
  expect(events.find(e => e.kind === "guard-failure")?.value.reason).toBe("eval_call_limit");
});
