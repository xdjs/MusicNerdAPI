import { NextResponse } from "next/server";
import { getArtistById } from "@/lib/artists/getArtistById";
import { db } from "@/lib/db/db";
import { buildFunFactPrompt } from "@/lib/funFacts/buildFunFactPrompt";
import { FUN_FACT_TIMEOUT_MS, FUN_FACT_TYPES } from "@/lib/funFacts/const";
import { generateFunFact } from "@/lib/funFacts/generateFunFact";
import { getFunFactPrompts } from "@/lib/funFacts/getFunFactPrompts";
import { validateFunFactQuery } from "@/lib/funFacts/validateFunFactQuery";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * Handles GET /api/funFacts/{type}?id=<artistId>: writes one fun fact of that
 * kind about the artist, as MusicNerdWeb's route did, in the same order of
 * checks. The whole request is bounded at 20 s.
 *
 * @param request - The request; `?id=<artistId>`.
 * @param type - The kind of fact from the path: surprise, lore, bts or activity.
 * @returns 200 with `{ status, text }`; 400, 404, 408 or 500 with `{ status, error }`.
 */
export async function getFunFactHandler(request: Request, type: string): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  const error = (message: string, status: number) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });

  const funFactOperation = async (): Promise<NextResponse> => {
    const query = validateFunFactQuery(request);
    if (query instanceof NextResponse) return query;

    const artist = await getArtistById(query.id);
    if (!artist) {
      console.error("Artist not found");
      return error("Artist not found", 404);
    }

    const publicLoreAllowed = !!(await findApprovedClaim(db, query.id));
    const prompts = await getFunFactPrompts();
    if (!prompts) {
      console.error("Failed to fetch prompts");
      return error("Failed to fetch prompts", 500);
    }

    const column = Object.hasOwn(FUN_FACT_TYPES, type)
      ? FUN_FACT_TYPES[type as keyof typeof FUN_FACT_TYPES]
      : undefined;
    const basePrompt = column ? prompts[column] : null;
    if (!basePrompt) {
      console.error("Invalid fun fact type");
      return error("Invalid fun fact type", 400);
    }

    const finalPrompt = await buildFunFactPrompt(basePrompt, artist, publicLoreAllowed);

    try {
      const text = await generateFunFact(finalPrompt);
      return NextResponse.json({ status: "ok", text }, { status: 200, headers });
    } catch (err) {
      console.error("Gemini error generating fun fact", err);
      if (err instanceof Error && err.message === "Gemini timeout") {
        return error("Fun fact generation timed out", 408);
      }
      return error("Failed to generate fun fact", 500);
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Fun fact generation timeout")), FUN_FACT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([funFactOperation(), timeoutPromise]);
  } catch (err) {
    console.error("Error in fun fact generation:", err);
    if (err instanceof Error && err.message === "Fun fact generation timeout") {
      return error("Fun fact generation timed out. Please try again later.", 408);
    }
    return error("Internal server error", 500);
  } finally {
    clearTimeout(timer);
  }
}
