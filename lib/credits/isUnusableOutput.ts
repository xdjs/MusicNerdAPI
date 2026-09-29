/**
 * The model answered, but not with the object the schema asks for. The AI SDK
 * raises these when the reply is empty or fails validation, carrying the raw
 * reply as `text`.
 *
 * @param e - What the call threw.
 * @returns True for the AI SDK's no-object and no-output errors.
 */
export function isUnusableOutput(e: unknown): e is { text?: unknown } {
  return /^AI_No(Object|Output)GeneratedError$/.test(
    String((e as { name?: unknown } | null)?.name),
  );
}
