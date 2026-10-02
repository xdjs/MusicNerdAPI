import type { TurnEvent } from "@/lib/onboarding/types";

const encoder = new TextEncoder();

/**
 * Writes one event to the stream as a server-sent `data:` line. Writing after
 * the client disconnected throws; that's logged, never an unhandled rejection.
 *
 * @param controller - The stream's controller.
 * @param event - The event.
 * @returns Nothing.
 */
export function sendTurnEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: TurnEvent,
): void {
  try {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  } catch (e) {
    console.error("[onboarding/chat] send after stream closed:", e);
  }
}
