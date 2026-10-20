import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { artists, funfacts } from "@/lib/db/schema";
import { generateText } from "@/lib/ai/generateText";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const TYPE_MAP: Record<string, "surpriseMe" | "loreDrop" | "behindTheScenes" | "recentActivity"> = {
  surprise: "surpriseMe",
  lore: "loreDrop",
  bts: "behindTheScenes",
  activity: "recentActivity",
};

/**
 * Handles GET /api/funFacts/[type] — generate a fun fact about an artist.
 *
 * @param request - Authenticated request with `?id=artistId`.
 * @param type - One of: surprise, lore, bts, activity.
 * @returns 200 with `{ status: "ok", text }`.
 */
export async function getFunFactsHandler(request: Request, type: string): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const column = TYPE_MAP[type];
  if (!column) {
    return NextResponse.json(
      {
        status: "error",
        error: `Invalid fun fact type: ${type}. Must be one of: surprise, lore, bts, activity`,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const url = new URL(request.url);
  const artistId = url.searchParams.get("id");
  if (!artistId) {
    return NextResponse.json(
      { status: "error", error: "id query parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const [artist] = await db
    .select({ id: artists.id, name: artists.name, bio: artists.bio })
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);
  if (!artist) {
    return NextResponse.json(
      { status: "error", error: "Artist not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const [activePrompt] = await db
    .select()
    .from(funfacts)
    .where(eq(funfacts.isActive, true))
    .limit(1);
  if (!activePrompt) {
    return NextResponse.json(
      { status: "error", error: "No active fun facts prompt configured" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const promptTemplate = activePrompt[column];
  if (!promptTemplate) {
    return NextResponse.json(
      { status: "error", error: `No prompt template for type: ${type}` },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const prompt = promptTemplate
    .replace(/\{artistName\}/g, artist.name ?? "Unknown Artist")
    .replace(/\{bio\}/g, artist.bio ?? "");

  const result = await generateText({ prompt });

  return NextResponse.json(
    { status: "ok", text: result.text },
    { status: 200, headers: getCorsHeaders() },
  );
}
