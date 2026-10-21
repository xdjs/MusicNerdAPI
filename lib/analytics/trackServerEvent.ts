import { track } from "@vercel/analytics/server";

/**
 * Sends one custom Web Analytics event from a route handler. Vercel's `track`
 * reads the request headers and `waitUntil` from its request context; outside
 * Vercel it logs and returns. A request must never fail because of analytics.
 *
 * @param name - The event, e.g. `profile_edit`.
 * @param props - Its properties.
 * @returns Nothing, whatever `track` does.
 */
export async function trackServerEvent(
  name: string,
  props: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await track(name, props);
  } catch (error) {
    console.error("[analytics] server track failed:", error);
  }
}
