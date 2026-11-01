import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { wrapLanguageModel } from "ai";
import { z } from "zod";
import { MODEL_CHAT } from "@/lib/ai/const";
import { streamText } from "@/lib/ai/streamText";

const manifestSchema = z
  .object({
    version: z.literal(1),
    runId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    modelId: z.literal(MODEL_CHAT),
    promptSha256: z.string().regex(/^[a-f0-9]{64}$/),
    instructionsSha256: z.string().regex(/^[a-f0-9]{64}$/),
    toolLimits: z.partialRecord(
      z.enum([
        "searchSources",
        "readSource",
        "webSearch",
        "searchPdfSources",
        "readPdfSource",
        "readNamedPdf",
      ]),
      z.number().int().min(1).max(6),
    ),
    maxToolExecutions: z.number().int().min(1).max(12),
    maxCalls: z.number().int().min(1).max(6),
    maxInputBytes: z.number().int().min(1).max(128000),
    maxOutputTokens: z.number().int().min(1).max(2048),
    maxOutputCharacters: z.number().int().min(1).max(8192),
    maxCaptureBytes: z.number().int().min(1).max(1000000),
  })
  .strict();

/** Evaluator-only, one-turn forwarding guard. Never imported by an HTTP route. */
export function createGuardedChatExecution({
  manifestPath,
  manifestSha256,
  model,
  record,
}: {
  manifestPath: string;
  manifestSha256: string;
  model: Parameters<typeof wrapLanguageModel>[0]["model"];
  /** Private synchronous evidence sink: no credentials, automatic upload or console logging. */
  record: (kind: string, value: unknown) => void;
}): typeof streamText {
  const raw = readFileSync(manifestPath);
  if (createHash("sha256").update(raw).digest("hex") !== manifestSha256)
    throw new Error("eval_manifest_mismatch");
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")));
  if (model.modelId !== manifest.modelId) throw new Error("eval_model_mismatch");
  let used = false;
  let failed = false;
  let failureReason: string | undefined;
  let calls = 0;
  let bytes = 0;
  let outputCharacters = 0;
  let toolExecutions = 0;
  const toolCounts = new Map<string, number>();
  const abort = new AbortController();
  const fail = (reason: string): never => {
    failed = true;
    failureReason ??= reason;
    abort.abort();
    throw new Error(failureReason);
  };
  const check = () => {
    if (failed || abort.signal.aborted) fail(failureReason ?? "eval_already_failed");
  };
  const capture = (kind: string, value: unknown) => {
    check();
    let serialized: string;
    try {
      serialized = JSON.stringify({ kind, value });
    } catch {
      return fail("eval_capture_encoding");
    }
    if (bytes + Buffer.byteLength(serialized) > manifest.maxCaptureBytes)
      fail("eval_capture_limit");
    bytes += Buffer.byteLength(serialized);
    try {
      record(kind, JSON.parse(serialized).value);
    } catch {
      fail("eval_capture_write");
    }
  };
  const wrapped = wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async () => fail("eval_generate_forbidden"),
      wrapStream: async ({ params, doStream }) => {
        check();
        if (params.abortSignal?.aborted) fail("eval_aborted");
        if (params.headers && Object.keys(params.headers).length) fail("eval_headers_unsupported");
        if (params.maxOutputTokens !== manifest.maxOutputTokens) fail("eval_output_limit_missing");
        // This canary permits text inputs only; binary/PDF inputs require separate budgeting.
        for (const message of params.prompt) {
          if (
            Array.isArray(message.content) &&
            message.content.some(
              part =>
                !["text", "tool-call", "tool-result", "reasoning"].includes(part.type) ||
                (part.type === "tool-result" &&
                  part.output.type === "content" &&
                  part.output.value.some(item => item.type !== "text")),
            )
          )
            fail("eval_nontext_input");
        }
        const { abortSignal: _signal, headers: _headers, ...prepared } = params;
        if (Buffer.byteLength(JSON.stringify(prepared)) > manifest.maxInputBytes)
          fail("eval_input_limit");
        if (calls >= manifest.maxCalls) fail("eval_call_limit");
        capture("model-input", { call: calls + 1, prepared });
        calls++;
        const result = await doStream();
        let finished = false;
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream({
              transform(part, controller) {
                check();
                if (finished) fail("eval_output_after_finish");
                if (part.type === "error") fail("eval_provider_error");
                if (part.type === "response-metadata") {
                  for (const value of [part.id, part.modelId]) {
                    if (value !== undefined && (typeof value !== "string" || value.length > 256))
                      fail("eval_response_identity_invalid");
                  }
                  capture("model-response-identity", {
                    call: calls,
                    responseId: part.id ?? null,
                    modelId: part.modelId ?? null,
                  });
                }
                const text =
                  part.type === "text-delta" || part.type === "reasoning-delta"
                    ? part.delta
                    : part.type === "tool-call"
                      ? part.input
                      : "";
                outputCharacters += text.length;
                if (outputCharacters > manifest.maxOutputCharacters) fail("eval_output_limit");
                if (part.type === "finish") {
                  finished = true;
                  capture("model-finish", {
                    call: calls,
                    finishReason: part.finishReason,
                    usage: part.usage,
                  });
                  const input = part.usage.inputTokens.total;
                  const output = part.usage.outputTokens.total;
                  if (
                    !Number.isSafeInteger(input) ||
                    input! < 0 ||
                    !Number.isSafeInteger(output) ||
                    output! < 0 ||
                    output! > manifest.maxOutputTokens
                  )
                    fail("eval_usage_invalid");
                  if (!["stop", "tool-calls"].includes(part.finishReason.unified))
                    fail("eval_abnormal_finish");
                } else if (text) {
                  capture("model-output", { call: calls, type: part.type, text });
                }
                controller.enqueue(part);
              },
              flush() {
                if (!finished) fail("eval_missing_finish");
              },
            }),
          ),
        };
      },
    },
  });
  return async options => {
    if (used) fail("eval_already_dispatched");
    used = true;
    if (options.model !== manifest.modelId) fail("eval_model_mismatch");
    if (
      createHash("sha256").update(JSON.stringify(options.prompt)).digest("hex") !==
      manifest.promptSha256
    )
      fail("eval_prompt_mismatch");
    if (options.abortSignal?.aborted) fail("eval_aborted");
    // Reject incompatible experiments before spending. Never advertise a tool
    // without a declared execution budget; do not silently filter it.
    if (
      createHash("sha256")
        .update(JSON.stringify(options.instructions ?? null))
        .digest("hex") !== manifest.instructionsSha256
    )
      fail("eval_instructions_mismatch");
    if (
      Object.entries(options.tools ?? {}).some(
        ([name, tool]) => !Object.hasOwn(manifest.toolLimits, name) || !tool.execute,
      )
    )
      fail("eval_tool_scope_mismatch");
    // Exclusive-create is the durable one-shot boundary. Never remove on failure.
    const fd = openSync(`${manifestPath}.DISPATCHED`, "wx", 0o600);
    try {
      writeFileSync(fd, JSON.stringify({ runId: manifest.runId, manifestSha256 }));
    } finally {
      closeSync(fd);
    }
    capture("dispatch", { runId: manifest.runId, manifestSha256 });
    const tools = Object.fromEntries(
      Object.entries(options.tools ?? {}).map(([name, tool]) => [
        name,
        {
          ...tool,
          execute: async (...args: Parameters<NonNullable<typeof tool.execute>>) => {
            check();
            const limit = manifest.toolLimits[name as keyof typeof manifest.toolLimits];
            const count = toolCounts.get(name) ?? 0;
            if (!limit || !tool.execute) fail("eval_unbudgeted_tool");
            if (count >= (limit ?? 0) || toolExecutions >= manifest.maxToolExecutions)
              fail("eval_tool_limit");
            // Synchronous reservation before any await: parallel calls cannot
            // each observe the same remaining allowance. Failures stay consumed.
            toolCounts.set(name, count + 1);
            toolExecutions++;
            capture("tool-input", { name, input: args[0] });
            const result = await tool.execute!(...args);
            capture("tool-output", { name, result });
            return result;
          },
        },
      ]),
    );
    try {
      const result = await streamText({
        ...options,
        model: wrapped,
        tools,
        maxRetries: 0,
        streamRetries: 0,
        maxOutputTokens: manifest.maxOutputTokens,
        abortSignal: options.abortSignal
          ? AbortSignal.any([options.abortSignal, abort.signal])
          : abort.signal,
      });
      check();
      if (options.abortSignal?.aborted) fail("eval_aborted");
      return result;
    } catch (error) {
      failed = true;
      abort.abort();
      throw error;
    }
  };
}
