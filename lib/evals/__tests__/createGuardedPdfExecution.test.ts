import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { streamText as sdkStreamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { MODEL_CHAT } from "@/lib/ai/const";
import { createGuardedChatExecution } from "../createGuardedChatExecution";
const m = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/streamText", () => ({ streamText: m.stream }));
const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const binary = readFileSync(
  new URL("../../vaultUpload/__tests__/fixtures/text.pdf", import.meta.url),
);
const pin = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  filename: "test.pdf",
  bytes: binary.length,
  pages: 1,
  sha256: hash(binary),
};
const result = { sourceId: pin.sourceId, title: pin.filename, pages: 1, sha256: pin.sha256, n: 1 };
const output = {
  type: "content" as const,
  value: [
    { type: "text" as const, text: JSON.stringify(result) },
    {
      type: "file" as const,
      mediaType: "application/pdf",
      filename: pin.filename,
      data: { type: "data" as const, data: binary.toString("base64") },
    },
  ],
};
const input = {
  prompt: [
    {
      role: "tool" as const,
      content: [
        { type: "tool-result" as const, toolCallId: "t", toolName: "readPdfSource", output },
      ],
    },
  ],
  maxOutputTokens: 1024,
};
const finish = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
};
let dir: string;
let events: { kind: string; value: any }[];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mn-pdf-"));
  events = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network forbidden");
    }),
  );
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(
  pdfLimits = {},
  opts: {
    textOnly?: boolean;
    record?: (kind: string, value: unknown) => void;
    validate?: () => Promise<void>;
    catalog?: () => Promise<void>;
  } = {},
) {
  const forward = vi.fn(async () => ({
    stream: new ReadableStream({
      start(c) {
        c.enqueue(finish);
        c.close();
      },
    }),
  }));
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: forward });
  const manifest = {
    version: 1,
    runId: "offline-pdf",
    modelId: MODEL_CHAT,
    promptSha256: hash(JSON.stringify("q")),
    instructionsSha256: hash("null"),
    toolLimits: { readPdfSource: 2, searchPdfSources: 6 },
    maxToolExecutions: 12,
    maxCalls: 6,
    maxInputBytes: 128000,
    maxTotalInputBytes: 196608,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
    ...(!opts.textOnly
      ? {
          pdf: {
            documents: [pin],
            maxUniqueDocuments: 2,
            maxBytesPerCall: binary.length,
            maxTotalBytes: binary.length * 2,
            maxPagesPerCall: 1,
            maxTotalPages: 2,
            ...pdfLimits,
          },
        }
      : {}),
  };
  const raw = JSON.stringify(manifest),
    path = join(dir, "manifest.json");
  writeFileSync(path, raw);
  const validate = vi.fn(opts.validate ?? (async () => {}));
  const execute = createGuardedChatExecution({
    manifestPath: path,
    manifestSha256: hash(raw),
    model,
    record: opts.record ?? ((kind, value) => events.push({ kind, value })),
    validatePdfSource: validate,
    validatePdfCatalog: opts.catalog,
  });
  const read = tool({
    inputSchema: z.object({}),
    execute: async () => result,
    toModelOutput: () => output,
  });
  return {
    execute,
    forward,
    validate,
    options: { model: MODEL_CHAT, prompt: "q", tools: { readPdfSource: read } },
  };
}
async function register(o: any) {
  await o.tools.readPdfSource.execute({}, { toolCallId: "t", messages: [] });
}
it.each([
  { revision: "stale" },
  { revision: pin.revision, textPages: [{}] },
  { unreviewedPrivateField: "must not be captured or forwarded" },
])("rejects stale, incomplete or unexpected current PDF metadata", async extra => {
  const s = setup();
  s.options.tools.readPdfSource.execute = (async () => ({ ...result, ...extra })) as never;
  m.stream.mockImplementation(async o => {
    await register(o);
    await o.model.doStream(input);
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_identity");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.filter(e => e.kind === "tool-output")).toHaveLength(0);
});
it("rejects an error-only PDF result carrying unexpected base64 before capture or forwarding", async () => {
  const s = setup();
  s.options.tools.readPdfSource.execute = (async () => ({
    error: "PDF unavailable",
    unexpectedPrivateField: binary.toString("base64"),
  })) as never;
  m.stream.mockImplementation(async o => {
    await register(o);
    await o.model.doStream(input);
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_identity");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.some(e => e.kind === "tool-output")).toBe(false);
  expect(JSON.stringify(events)).not.toContain(binary.toString("base64"));
});
it("rejects a conflicting PDF recipient before any provider forward", async () => {
  const s = setup();
  m.stream.mockImplementation(async o => {
    await o.model.doStream({
      prompt: [],
      maxOutputTokens: 1024,
      providerOptions: { gateway: { only: ["vertex"] } },
    });
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_routing_mismatch");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.find(e => e.kind === "guard-failure")?.value.reason).toBe("eval_routing_mismatch");
});
it.each([undefined, { only: ["anthropic"] }])(
  "pins approved recipient for text-only inputs (%j)",
  async routing => {
    const s = setup({}, { textOnly: true });
    m.stream.mockImplementation(async o => {
      const result = await o.model.doStream({
        prompt: [],
        maxOutputTokens: 1024,
        providerOptions: {
          anthropic: { effort: "medium" },
          ...(routing ? { gateway: routing } : {}),
        },
      });
      const reader = result.stream.getReader();
      while (!(await reader.read()).done) {
        /* Drain offline fixture. */
      }
      return { text: "" };
    });
    await s.execute(s.options);
    expect(s.forward).toHaveBeenCalledTimes(1);
    expect(events.find(e => e.kind === "model-input")?.value.prepared.providerOptions).toEqual({
      anthropic: { effort: "medium" },
      gateway: { only: ["anthropic"] },
    });
  },
);
it.each([
  { only: ["vertex"] },
  { only: ["anthropic"], order: ["anthropic"] },
  { only: ["anthropic"], caching: "auto" },
])("rejects additional text routing settings before forwarding (%j)", async routing => {
  const s = setup({}, { textOnly: true });
  m.stream.mockImplementation(async o => {
    await o.model.doStream({
      prompt: [],
      maxOutputTokens: 1024,
      providerOptions: { gateway: routing },
    });
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_routing_mismatch");
  expect(s.forward).not.toHaveBeenCalled();
});
it("installed SDK converts original tool output unchanged; ledger contains verified references, not binary", async () => {
  const s = setup();
  let n = 0;
  s.forward.mockImplementation(async () => ({
    stream: new ReadableStream({
      start(c) {
        if (n++ === 0) {
          c.enqueue({ type: "tool-call", toolCallId: "t", toolName: "readPdfSource", input: "{}" });
          c.enqueue({ ...finish, finishReason: { unified: "tool-calls", raw: undefined } });
        } else c.enqueue(finish);
        c.close();
      },
    }),
  }));
  m.stream.mockImplementation(async (o: any) => {
    const r = sdkStreamText({
      model: o.model,
      prompt: o.prompt,
      tools: o.tools,
      maxOutputTokens: 1024,
      maxRetries: 0,
      stopWhen: stepCountIs(2),
    });
    await r.consumeStream();
    return r;
  });
  await s.execute(s.options);
  expect(s.forward).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(s.forward.mock.calls[1])).toContain(binary.toString("base64"));
  expect(JSON.stringify(events)).not.toContain(binary.toString("base64"));
  expect(events.find(e => e.kind === "model-input" && e.value.pdfBytes)?.value).toMatchObject({
    pdfBytes: binary.length,
    pdfPages: 1,
    binaryCapture: "verified-reference-only",
  });
  expect(s.validate).toHaveBeenCalledTimes(2);
});
it("repeated attachments charge every forward, then reject without refund", async () => {
  const s = setup();
  m.stream.mockImplementation(async o => {
    await register(o);
    await o.model.doStream(input);
    await o.model.doStream(input);
    await o.model.doStream(input);
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_limit");
  expect(s.forward).toHaveBeenCalledTimes(2);
  expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
    consumedPdfBytes: binary.length * 2,
    consumedPdfPages: 2,
  });
});
it.each(["per-call bytes", "per-call pages", "revision", "capture", "text-only"])(
  "blocks %s before provider forward",
  async kind => {
    const s = setup(
      kind === "per-call bytes"
        ? { maxBytesPerCall: binary.length - 1 }
        : kind === "per-call pages"
          ? { maxPagesPerCall: 1, maxBytesPerCall: binary.length * 2 }
          : {},
      {
        textOnly: kind === "text-only",
        validate:
          kind === "revision"
            ? async () => {
                throw new Error("stale");
              }
            : undefined,
        record:
          kind === "capture"
            ? k => {
                if (k === "model-input") throw new Error("disk");
              }
            : undefined,
      },
    );
    m.stream.mockImplementation(async o => {
      await register(o);
      const p =
        kind === "per-call pages"
          ? { ...input, prompt: [...input.prompt, ...input.prompt] }
          : input;
      await o.model.doStream(p);
    });
    await expect(s.execute(s.options)).rejects.toThrow();
    expect(s.forward).not.toHaveBeenCalled();
  },
);
it("parallel repeated forwards cannot over-reserve PDF allowance", async () => {
  const s = setup({ maxTotalBytes: binary.length, maxTotalPages: 1 });
  m.stream.mockImplementation(async o => {
    await register(o);
    const r = await Promise.allSettled([o.model.doStream(input), o.model.doStream(input)]);
    expect(r.filter(x => x.status === "rejected").length).toBeGreaterThan(0);
    throw new Error("expected failure");
  });
  await expect(s.execute(s.options)).rejects.toThrow();
  expect(s.forward.mock.calls.length).toBeLessThanOrEqual(1);
  expect(events.find(e => e.kind === "guard-failure")?.value.consumedPdfBytes).toBe(binary.length);
});

it("failed PDF forward retains complete input and binary reservation", async () => {
  const s = setup({ maxTotalBytes: binary.length, maxTotalPages: 1 });
  s.forward.mockRejectedValue(new Error("uncertain"));
  m.stream.mockImplementation(async o => {
    await register(o);
    await expect(o.model.doStream(input)).rejects.toThrow("uncertain");
    await o.model.doStream(input);
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_limit");
  expect(s.forward).toHaveBeenCalledTimes(1);
});
it("bounds the combined PDF read attempts even when the same document is repeated", async () => {
  const s = setup();
  m.stream.mockImplementation(async o => {
    await register(o);
    await register(o);
    await register(o);
  });
  await expect(s.execute(s.options)).rejects.toThrow();
  expect(s.forward).not.toHaveBeenCalled();
});

it("revalidates the pinned revision after discovery/read before each PDF-bearing forward", async () => {
  let validations = 0;
  const s = setup(
    {},
    {
      validate: async () => {
        if (++validations === 2) throw new Error("revoked or changed revision");
      },
    },
  );
  m.stream.mockImplementation(async o => {
    await register(o);
    await o.model.doStream(input);
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_validation_failed");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.find(e => e.kind === "guard-failure")?.value.consumedPdfBytes).toBe(binary.length);
});

it("caller cancellation during current-source validation prevents forwarding without refund", async () => {
  const cancel = new AbortController();
  let validations = 0;
  const s = setup(
    {},
    {
      validate: async () => {
        if (++validations === 2) cancel.abort();
      },
    },
  );
  m.stream.mockImplementation(async o => {
    await register(o);
    await o.model.doStream({ ...input, abortSignal: cancel.signal });
  });
  await expect(s.execute(s.options)).rejects.toThrow();
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.find(e => e.kind === "guard-failure")?.value.consumedPdfBytes).toBe(binary.length);
});

it("blocks a changed full PDF catalog before a text-only next model input", async () => {
  const s = setup(
    {},
    {
      catalog: async () => {
        throw new Error("new eligible PDF");
      },
    },
  );
  m.stream.mockImplementation(async o => o.model.doStream({ prompt: [], maxOutputTokens: 1024 }));
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_catalog_changed");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.find(e => e.kind === "guard-failure")?.value.calls).toBe(1);
});
it("does not capture or forward discovery metadata after catalog drift", async () => {
  const s = setup(
    {},
    {
      catalog: async () => {
        throw new Error("new eligible PDF");
      },
    },
  );
  (s.options.tools as any).searchPdfSources = tool({
    inputSchema: z.object({}),
    execute: async () => ({
      sources: [{ sourceId: "new", title: "new public PDF", url: "https://example.test/new.pdf" }],
    }),
  });
  m.stream.mockImplementation(async o => {
    await o.tools.searchPdfSources.execute({}, { toolCallId: "discover", messages: [] });
    await o.model.doStream({ prompt: [], maxOutputTokens: 1024 });
  });
  await expect(s.execute(s.options)).rejects.toThrow("eval_pdf_catalog_changed");
  expect(s.forward).not.toHaveBeenCalled();
  expect(events.some(e => e.kind === "tool-output")).toBe(false);
});
