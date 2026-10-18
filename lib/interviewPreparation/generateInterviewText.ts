import { generateText, type OutputInterface } from "ai";
/** Scoped interview writer/checker; bounded output and explicit low reasoning effort. */
export function generateInterviewText<OUTPUT extends OutputInterface>(options: {
  model: string;
  instructions: string;
  prompt: string;
  output: OUTPUT;
  temperature?: number;
  thinkingBudget?: number;
  thinkingLevel?: "low";
  maxOutputTokens: number;
  maxRetries: number;
  abortSignal: AbortSignal;
}) {
  const { thinkingBudget, thinkingLevel, ...rest } = options;
  return generateText({
    ...rest,
    providerOptions: {
      ...(thinkingBudget !== undefined || thinkingLevel !== undefined
        ? { google: { thinkingConfig: { thinkingBudget, thinkingLevel } } }
        : {}),
      ...(options.model.startsWith("anthropic/") ? { anthropic: { effort: "low" } } : {}),
    },
  });
}
