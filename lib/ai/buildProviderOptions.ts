import type { GenerateTextOptions } from "@/lib/ai/generateText";

type ReasoningOptions = Pick<
  GenerateTextOptions,
  "thinkingBudget" | "thinkingLevel" | "anthropicEffort"
>;

/**
 * The AI SDK `providerOptions` for a call's reasoning settings: Gemini's
 * thinking budget or level, and Anthropic's effort.
 *
 * @param options - The call's reasoning settings.
 * @returns The provider options, or undefined when none are set.
 */
export function buildProviderOptions({
  thinkingBudget,
  thinkingLevel,
  anthropicEffort,
}: ReasoningOptions) {
  if (thinkingBudget === undefined && thinkingLevel === undefined && anthropicEffort === undefined)
    return undefined;
  return {
    ...(thinkingBudget !== undefined || thinkingLevel !== undefined
      ? { google: { thinkingConfig: { thinkingBudget, thinkingLevel } } }
      : {}),
    ...(anthropicEffort !== undefined ? { anthropic: { effort: anthropicEffort } } : {}),
  };
}
