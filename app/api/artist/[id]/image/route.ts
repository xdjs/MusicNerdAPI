import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Public artist image redirect (307). Returns the custom image URL or 404.
 *
 * @param _request - The incoming request (unused).
 * @param context - Route context containing the artist ID.
 * @param context.params - Promise resolving to `{ id: string }`.
 * @returns 307 redirect to the image, or 400/404/503.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const unavailable = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return unavailable(400);
  try {
    const artist = await db.query.artists.findFirst({ where: eq(artists.id, id) });
    if (!artist) return unavailable(404);
    const custom = artist.customImage;
    if (!custom) return unavailable(404);
    // Validate the URL
    try {
      const url = new URL(custom);
      if (url.protocol !== "https:" || url.username || url.password) return unavailable(404);
      if (/default|placeholder|musicnerdlogo/i.test(custom)) return unavailable(404);
      return new Response(null, {
        status: 307,
        headers: {
          Location: url.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return unavailable(404);
    }
  } catch {
    return unavailable(503);
  }
}
