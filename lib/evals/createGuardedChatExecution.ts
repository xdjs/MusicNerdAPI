import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { wrapLanguageModel } from "ai";
import { z } from "zod";
import { MODEL_CHAT } from "@/lib/ai/const";
import { streamText } from "@/lib/ai/streamText";

import { inspectChatPdf } from "@/lib/chatPdf/inspectChatPdf";
import { pdfEvalSchema, type PdfEvalDocument } from "./pdfEvalTypes";
import { preparePdfEvalInput } from "./preparePdfEvalInput";

const manifestSchema = z
  .object({
    version: z.literal(1),
    pdf: pdfEvalSchema.optional(),
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
    maxTotalInputBytes: z.number().int().min(1).max(196608),
    maxOutputTokens: z.number().int().min(1).max(2048),
    maxOutputCharacters: z.number().int().min(1).max(8192),
    maxCaptureBytes: z.number().int().min(1).max(1000000),
  })
  .strict()
  .refine(m => !m.pdf || m.maxOutputTokens <= 1024, "PDF output allowance exceeds reviewed limit");

/** Evaluator-only, one-turn forwarding guard. Never imported by an HTTP route. */
export function createGuardedChatExecution({
  manifestPath,
  manifestSha256,
  model,
  record,
  validatePdfSource,
}: {
  manifestPath: string;
  manifestSha256: string;
  model: Parameters<typeof wrapLanguageModel>[0]["model"];
  /** Private synchronous evidence sink: no credentials, automatic upload or console logging. */
  record: (kind: string, value: unknown) => void;
  /** Required in PDF mode: assert current authorized source and exact pinned revision. */
  validatePdfSource?: (document: PdfEvalDocument) => Promise<void>;
}): typeof streamText {
  const raw = readFileSync(manifestPath);
  if (createHash("sha256").update(raw).digest("hex") !== manifestSha256)
    throw new Error("eval_manifest_mismatch");
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")));
  if (model.modelId !== manifest.modelId) throw new Error("eval_model_mismatch");
  if (manifest.pdf && !validatePdfSource) throw new Error("eval_pdf_validator_missing");
  const successfulReads = new Map<string, PdfEvalDocument>();
  const uniquePdfs = new Set<string>();
  const inspected = new Map<string, Promise<number>>();
  let pdfReadAttempts = 0;
  let consumedPdfBytes = 0;
  let consumedPdfPages = 0;
  let used = false;
  let failed = false;
  let failureReason: string | undefined;
  let calls = 0;
  let consumedInputBytes = 0;
  let bytes = 0;
  let outputCharacters = 0;
  let toolExecutions = 0;
  const toolCounts = new Map<string, number>();
  const abort = new AbortController();
  const fail = (
    reason: string,
    admission?: {
      inputBytes?: number;
      attemptedCall: number;
      pdfBytes?: number;
      pdfPages?: number;
    },
  ): never => {
    const firstFailure = !failed;
    failed = true;
    failureReason ??= reason;
    if (firstFailure) {
      const value = {
        reason: failureReason,
        calls,
        toolExecutions,
        consumedInputBytes,
        consumedPdfBytes,
        consumedPdfPages,
        remainingInputBytes: manifest.maxTotalInputBytes - consumedInputBytes,
        ...admission,
      };
      const size = Buffer.byteLength(JSON.stringify({ kind: "guard-failure", value }));
      if (bytes + size <= manifest.maxCaptureBytes) {
        bytes += size;
        try {
          record("guard-failure", value);
        } catch {
          /* Preserve the original failure. */
        }
      }
    }
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
      // PDF acceptance's reviewed recipient is Anthropic; normal routes/text evaluators are unchanged.
      transformParams: async ({ params }) => {
        if (!manifest.pdf) return params;
        const routing = params.providerOptions?.gateway;
        if (routing && JSON.stringify(routing) !== JSON.stringify({ only: ["anthropic"] }))
          fail("eval_pdf_routing_mismatch");
        return {
          ...params,
          providerOptions: { ...params.providerOptions, gateway: { only: ["anthropic"] } },
        };
      },
      wrapGenerate: async () => fail("eval_generate_forbidden"),
      wrapStream: async ({ params, doStream }) => {
        check();
        if (params.abortSignal?.aborted) fail("eval_aborted");
        if (params.headers && Object.keys(params.headers).length) fail("eval_headers_unsupported");
        if (params.maxOutputTokens !== manifest.maxOutputTokens) fail("eval_output_limit_missing");
        // This canary permits text inputs only; binary/PDF inputs require separate budgeting.
        for (const message of manifest.pdf ? [] : params.prompt) {
          if (
            Array.isArray(message.content) &&
            message.content.some(
              part =>
                (!["text", "tool-call", "tool-result", "reasoning"].includes(part.type) &&
                  !(part.type === "custom" && part.kind === "anthropic.message_start")) ||
                (part.type === "tool-result" &&
                  part.output.type === "content" &&
                  part.output.value.some(item => item.type !== "text")),
            )
          )
            fail("eval_nontext_input");
        }
        const { abortSignal: _signal, headers: _headers, ...prepared } = params;
        let pdfInput: ReturnType<typeof preparePdfEvalInput> | undefined;
        if (manifest.pdf) {
          try {
            pdfInput = preparePdfEvalInput(prepared, successfulReads);
          } catch {
            fail("eval_pdf_input_invalid");
          }
        }
        const capturedPrepared = pdfInput?.prepared ?? prepared;
        const inputBytes = Buffer.byteLength(JSON.stringify(capturedPrepared));
        const pdfBytes = pdfInput?.pdfBytes ?? 0;
        const pdfPages = pdfInput?.pdfPages ?? 0;
        if (
          manifest.pdf &&
          (pdfBytes > manifest.pdf.maxBytesPerCall ||
            pdfBytes > manifest.pdf.maxTotalBytes - consumedPdfBytes ||
            pdfPages > manifest.pdf.maxPagesPerCall ||
            pdfPages > manifest.pdf.maxTotalPages - consumedPdfPages)
        )
          fail("eval_pdf_limit", { attemptedCall: calls + 1, pdfBytes, pdfPages });
        const admission = { inputBytes, attemptedCall: calls + 1 };
        if (inputBytes > manifest.maxInputBytes) fail("eval_input_limit", admission);
        if (inputBytes > manifest.maxTotalInputBytes - consumedInputBytes)
          fail("eval_total_input_limit", admission);
        if (calls >= manifest.maxCalls) fail("eval_call_limit", admission);
        // Reserve synchronously before capture/forward, including repeated or cached prefixes.
        // A failed capture or failed/uncertain forward never releases this reservation.
        consumedInputBytes += inputBytes;
        consumedPdfBytes += pdfBytes;
        consumedPdfPages += pdfPages;
        calls++;
        capture("model-input", {
          call: calls,
          prepared: capturedPrepared,
          ...(manifest.pdf
            ? {
                binaryCapture: "verified-reference-only",
                pdfBytes,
                pdfPages,
                consumedPdfBytes,
                consumedPdfPages,
              }
            : {}),
          inputBytes,
          consumedInputBytes,
          remainingInputBytes: manifest.maxTotalInputBytes - consumedInputBytes,
        });
        for (const file of pdfInput?.files ?? []) {
          try {
            await validatePdfSource!(file.document);
            if (!inspected.has(file.document.sha256))
              inspected.set(
                file.document.sha256,
                inspectChatPdf(
                  file.bytes,
                  AbortSignal.any([
                    abort.signal,
                    AbortSignal.timeout(5000),
                    ...(params.abortSignal ? [params.abortSignal] : []),
                  ]),
                ),
              );
            if ((await inspected.get(file.document.sha256)) !== file.document.pages)
              fail("eval_pdf_pages_mismatch");
          } catch {
            fail("eval_pdf_validation_failed");
          }
        }
        check();
        if (params.abortSignal?.aborted) fail("eval_aborted");
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
            if (manifest.pdf && ["readPdfSource", "readNamedPdf"].includes(name)) {
              if (pdfReadAttempts >= 2) fail("eval_pdf_read_limit");
              pdfReadAttempts++;
            }
            toolCounts.set(name, count + 1);
            toolExecutions++;
            capture("tool-input", { name, input: args[0] });
            const result = await tool.execute!(...args);
            if (
              manifest.pdf &&
              ["readPdfSource", "readNamedPdf"].includes(name) &&
              result &&
              typeof result === "object" &&
              "sha256" in result
            ) {
              const value = result as Record<string, unknown>;
              const document = manifest.pdf.documents.find(d => d.sourceId === value.sourceId);
              if (
                !document ||
                value.sha256 !== document.sha256 ||
                value.pages !== document.pages ||
                value.title !== document.filename ||
                Object.keys(value).some(
                  k => !["sourceId", "n", "title", "pages", "sha256"].includes(k),
                )
              )
                fail("eval_pdf_identity");
              uniquePdfs.add(document!.sourceId);
              if (uniquePdfs.size > manifest.pdf.maxUniqueDocuments) fail("eval_pdf_unique_limit");
              try {
                await validatePdfSource!(document!);
              } catch {
                fail("eval_pdf_validation_failed");
              }
              check();
              const prior = successfulReads.get(args[1].toolCallId);
              if (prior && prior.sourceId !== document!.sourceId) fail("eval_pdf_call_identity");
              successfulReads.set(args[1].toolCallId, document!);
            }
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
