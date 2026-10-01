import { streamText as sdkStreamText } from "ai";
import { MODEL_FLASH } from "@/lib/ai/const";
import type { GenerateTextOptions } from "@/lib/ai/generateText";

export type StreamTextOptions = Omit<GenerateTextOptions, "output"> & {
  /** Called with each piece of text as the model writes it. */
  onTextDelta?: (delta: string) => void;
};

/**
 * `generateText` for a call whose text is shown while it's written (the
 * onboarding build popup). Resolves `{ text }` once the stream ends. The SDK's
 * streamText never throws: a failed request arrives as an `error` part, which
 * is rethrown so the call rejects the way `generateText` does.
 *
 * @param options - The model, prompt, settings and `onTextDelta`.
 * @returns The whole text.
 */
export async function streamText(options: StreamTextOptions): Promise<{ text: string }> {
  const {
    model = MODEL_FLASH,
    instructions,
    prompt,
    temperature,
    thinkingBudget,
    onTextDelta,
  } = options;
  const result = sdkStreamText({
    model,
    instructions,
    prompt,
    temperature,
    ...(thinkingBudget !== undefined
      ? { providerOptions: { google: { thinkingConfig: { thinkingBudget } } } }
      : {}),
  });
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
