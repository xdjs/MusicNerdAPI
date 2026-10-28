import type { TextStreamPart, ToolSet } from "ai";

/**
 * Removes the provider's `custom` parts (e.g. `anthropic.message_start`, which
 * carries the model id, token usage and the provider's message id) from a
 * stream before it reaches a client. The SDK has no option for this.
 *
 * @param stream - A `streamText` result's stream.
 * @returns The stream without `custom` parts.
 */
export function withoutCustomParts<TOOLS extends ToolSet>(
  stream: ReadableStream<TextStreamPart<TOOLS>>,
): ReadableStream<TextStreamPart<TOOLS>> {
  return stream.pipeThrough(
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type !== "custom") controller.enqueue(part);
      },
    }),
  );
}
