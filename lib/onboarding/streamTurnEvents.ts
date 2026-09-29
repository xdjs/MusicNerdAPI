import { TURN_DEADLINE_MS, TURN_MESSAGES } from "@/lib/onboarding/const";
import { sendTurnEvent } from "@/lib/onboarding/sendTurnEvent";
import type { TurnEvent } from "@/lib/onboarding/types";

/**
 * A turn's events as a server-sent event stream. After 55 s it says so and
 * stops, before the 60 s function limit: the step stays unconfirmed and the
 * next turn resumes from the derived state. A thrown turn becomes a generic error.
 *
 * @param events - The turn's events.
 * @param startedAt - When the request started, in epoch milliseconds.
 * @returns The stream.
 */
export function streamTurnEvents(
  events: AsyncIterable<TurnEvent>,
  startedAt: number,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          sendTurnEvent(controller, event);
          if (Date.now() - startedAt > TURN_DEADLINE_MS) {
            sendTurnEvent(controller, { kind: "error", message: TURN_MESSAGES.tookTooLong });
            break;
          }
        }
      } catch (e) {
        console.error("[onboarding/chat] Turn error:", e);
        sendTurnEvent(controller, { kind: "error", message: TURN_MESSAGES.somethingWrong });
      } finally {
        try {
          controller.close();
        } catch (e) {
          console.error("[onboarding/chat] close after stream closed:", e);
        }
      }
    },
  });
}
