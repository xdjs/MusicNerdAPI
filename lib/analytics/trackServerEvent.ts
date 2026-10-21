import { track } from "@vercel/analytics/server";

/**
 * Sends one custom Web Analytics event from a route handler, as MusicNerdWeb's
 * routes did. Vercel's `track` reads the request headers from the request
 * context; outside Vercel it logs and returns. A request must never fail
 * because of analytics, so this resolves whatever `track` does.
 *
 * @param name - The event name, e.g. `profile_edit`.
 * @param props - The event's properties.
 * @returns Once sent, or once the failure is logged.
 */
export async function trackServerEvent(
  name: string,
  props: Record<string, string | null>,
): Promise<void> {
  try {
    await track(name, props);
  } catch (error) {
    console.error("[analytics] server track failed:", error);
  }
}
