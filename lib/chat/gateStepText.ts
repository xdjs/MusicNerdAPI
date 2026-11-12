import type { UIMessageChunk } from "ai";

/** Characters of a step's text held back before it streams, enough to cover a planning sentence. */
const HOLD_CHARACTERS = 240;

/**
 * Keeps the model's planning narration ("Let me read the key sources.") off the fan's
 * screen. The model sometimes writes a sentence before calling a tool even though the
 * instructions say not to; the client streams every text part, so that sentence would
 * appear and then be followed by the real answer. Text at the start of a step is held
 * until the step either calls a tool (the held text is dropped) or ends or grows past
 * the hold (the held text is released and the rest streams normally). The final
 * answer therefore streams with at most a short delay, and no text is lost on error.
 *
 * @returns A transform for the UI message chunk stream.
 */
export function gateStepText(): TransformStream<UIMessageChunk, UIMessageChunk> {
  let held: UIMessageChunk[] = [];
  let heldCharacters = 0;
  let released = false;
  let discarding = false;
  const reset = () => {
    held = [];
    heldCharacters = 0;
    released = false;
    discarding = false;
  };
  const flush = (controller: TransformStreamDefaultController<UIMessageChunk>) => {
    for (const chunk of held) controller.enqueue(chunk);
    held = [];
    released = true;
  };
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      switch (chunk.type) {
        case "start-step":
          reset();
          controller.enqueue(chunk);
          return;
        case "text-start":
        case "text-delta":
        case "text-end":
          if (discarding) return;
          if (released) {
            controller.enqueue(chunk);
            return;
          }
          held.push(chunk);
          if (chunk.type === "text-delta") heldCharacters += chunk.delta.length;
          if (heldCharacters > HOLD_CHARACTERS) flush(controller);
          return;
        case "tool-input-start":
        case "tool-input-delta":
        case "tool-input-available":
          // A step that calls a tool was planning, not answering.
          if (!released) {
            held = [];
            discarding = true;
          }
          controller.enqueue(chunk);
          return;
        case "finish-step":
          if (!discarding) flush(controller);
          controller.enqueue(chunk);
          reset();
          return;
        default:
          if (chunk.type === "finish" || chunk.type === "error" || chunk.type === "abort") {
            if (!discarding) flush(controller);
          }
          controller.enqueue(chunk);
      }
    },
    flush(controller) {
      if (!discarding) flush(controller);
    },
  });
}
