import { Output } from "ai";
import type { z } from "zod";
import { generateText, type GenerateTextOptions } from "@/lib/ai/generateText";

export type GenerateObjectOptions<T> = Omit<GenerateTextOptions, "output"> & {
  /** The object the model must return; `result.output` is validated against it. */
  schema: z.ZodType<T>;
};

/**
 * A model call whose reply is one object of the given shape.
 *
 * @param options - The schema, plus everything `generateText` takes.
 * @returns The AI SDK's result, with `output` typed by the schema.
 */
export function generateObject<T>({ schema, ...options }: GenerateObjectOptions<T>) {
  return generateText({ ...options, output: Output.object({ schema }) });
}
