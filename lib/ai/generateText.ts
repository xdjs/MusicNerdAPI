import { generateText as sdkGenerateText, type Output, type OutputInterface } from "ai";
import { MODEL_FLASH } from "@/lib/ai/const";

type TextOutput = ReturnType<typeof Output.text>;

export type GenerateTextOptions<OUTPUT extends OutputInterface = TextOutput> = {
  /** Gateway model id; defaults to Flash. */
  model?: string;
  /** The system instruction. */
  instructions?: string;
  prompt: string;
  temperature?: number;
  /** Gemini thinking budget in tokens; omitted means the model's default. */
  thinkingBudget?: number;
  /** `Output.object({ schema })` for a reply parsed as JSON. */
  output?: OUTPUT;
};

/**
 * The one entry point for model calls. Routes through Vercel AI Gateway, which
 * reads `AI_GATEWAY_API_KEY` (or the deployment's OIDC token).
 *
 * @param options - The model, prompt and settings.
 * @returns The AI SDK's result.
 */
export function generateText<OUTPUT extends OutputInterface = TextOutput>(
  options: GenerateTextOptions<OUTPUT>,
) {
  const {
    model = MODEL_FLASH,
    instructions,
    prompt,
    temperature,
    thinkingBudget,
    output,
  } = options;
  return sdkGenerateText({
    model,
    instructions,
    prompt,
    temperature,
    output,
    ...(thinkingBudget !== undefined
      ? { providerOptions: { google: { thinkingConfig: { thinkingBudget } } } }
      : {}),
  });
}
