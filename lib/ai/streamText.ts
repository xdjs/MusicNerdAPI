import {
  streamText as sdkStreamText,
  toUIMessageStream,
  type ModelMessage,
  type StopCondition,
  type ToolSet,
  type UIMessageStreamWriter,
} from "ai";
import { MODEL_FLASH } from "@/lib/ai/const";
import { buildProviderOptions } from "@/lib/ai/buildProviderOptions";
import type { GenerateTextOptions } from "@/lib/ai/generateText";
import { withoutCustomParts } from "@/lib/ai/withoutCustomParts";

export type StreamTextOptions = Omit<GenerateTextOptions, "output" | "prompt"> & {
  /** A text prompt, or a conversation as model messages. */
  prompt: string | ModelMessage[];
  /** Tools the model may call; omitted means a plain text call. */
  tools?: ToolSet;
  /** When a multi-step tool loop stops; omitted means one step. */
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
  /** Called with each piece of text as the model writes it. */
  onTextDelta?: (delta: string) => void;
  /** A chat response's writer: the call's UI message parts (text, tool steps) are merged into it. */
  writer?: UIMessageStreamWriter;
  /** Revalidate revocable tool evidence immediately before each model step. */
  beforeStep?: () => Promise<void>;
};

/**
 * `generateText` for a call whose text is shown while it's written (the
 * onboarding build popup, the artist chat). Resolves `{ text }` once the
 * stream ends. The SDK's streamText never throws: a failed request arrives as
 * an `error` part, which is rethrown so the call rejects the way
 * `generateText` does.
 *
 * @param options - The model, prompt, settings, tools, `onTextDelta` and `writer`.
 * @returns The whole text.
 */
export async function streamText(options: StreamTextOptions): Promise<{ text: string }> {
  const {
    model = MODEL_FLASH,
    instructions,
    prompt,
    temperature,
    thinkingBudget,
    thinkingLevel,
    anthropicEffort,
    tools,
    stopWhen,
    abortSignal,
    onTextDelta,
    writer,
    beforeStep,
  } = options;
  const providerOptions = buildProviderOptions({ thinkingBudget, thinkingLevel, anthropicEffort });
  const result = sdkStreamText({
    model,
    instructions,
    prompt,
    temperature,
    ...(beforeStep
      ? {
          prepareStep: async () => {
            await beforeStep();
            return {};
          },
        }
      : {}),
    tools,
    stopWhen,
    abortSignal,
    ...(providerOptions ? { providerOptions } : {}),
  });
  if (writer) writer.merge(toUIMessageStream({ stream: withoutCustomParts(result.stream), tools }));
  let text = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      text += part.text;
      onTextDelta?.(part.text);
    } else if (part.type === "error") {
      throw part.error;
    }
  }
  return { text };
}
