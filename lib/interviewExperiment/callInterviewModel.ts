import { Output } from "ai";
import type { z } from "zod";
import { generateText } from "@/lib/ai/generateText";
import type { ExperimentCall } from "@/lib/interviewExperiment/types";

/** One cancellable, measured experiment call through the existing Gateway client.
 * @param stage - Audit label.
 * @param instructions - Editorial or verification instructions.
 * @param payload - Bounded evidence and assignment.
 * @param schema - SDK-owned structured output schema.
 * @param model - Same explicit model for all arms.
 * @returns Parsed output and actual provider usage, never credentials or raw provider objects.
 */
export async function callInterviewModel<T>(
  stage: string,
  instructions: string,
  payload: unknown,
  schema: z.ZodType<T>,
  model: string,
): Promise<{ output: T; call: ExperimentCall }> {
  const prompt = JSON.stringify(payload);
  const promptBytes = Buffer.byteLength(instructions + prompt, "utf8");
  if (promptBytes > 90000) throw new Error("Experiment prompt exceeds conservative byte budget");
  const started = Date.now();
  try {
    const result = await generateText({
      model,
      instructions: instructions + "\nFollow the provided structured-output schema.",
      prompt,
      temperature: stage === "draft" ? 0.8 : 0,
      thinkingBudget: 512,
      maxOutputTokens: 6144,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(45000),
      output: Output.object({ schema }),
    });
    return {
      output: result.output,
      call: {
        stage,
        elapsedMs: Date.now() - started,
        inputTokens: result.totalUsage.inputTokens ?? null,
        outputTokens: result.totalUsage.outputTokens ?? null,
        promptBytes,
      },
    };
  } catch (error) {
    const detail = error as {
      name?: string;
      finishReason?: string;
      usage?: { inputTokens?: number; outputTokens?: number };
      cause?: unknown;
    };
    let cause: unknown = detail?.cause;
    const issues: string[] = [];
    for (let depth = 0; depth < 4 && cause && typeof cause === "object"; depth++) {
      const item = cause as { cause?: unknown; issues?: { path?: unknown[]; code?: string }[] };
      for (const issue of item.issues ?? [])
        issues.push(`${(issue.path ?? []).join(".")}:${issue.code ?? "invalid"}`);
      cause = item.cause;
    }
    throw Object.assign(
      new Error(
        `${stage}: ${detail?.name ?? "model error"}; finish=${detail?.finishReason ?? "unknown"}; ${issues.join(",") || "no structured result"}`,
      ),
      {
        call: {
          stage,
          elapsedMs: Date.now() - started,
          inputTokens: detail?.usage?.inputTokens ?? null,
          outputTokens: detail?.usage?.outputTokens ?? null,
          promptBytes,
        },
      },
    );
  }
}
