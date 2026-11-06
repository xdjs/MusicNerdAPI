import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getArtistDoc } from "@/lib/lore/getArtistDoc";
import { getDocCorrections } from "@/lib/lore/getDocCorrections";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artist/{id}/knowledge-doc: the claimant or an admin reads
 * the Lore document, its numbered sources and the artist's corrections. This
 * is working material about a person, so it is never served to visitors.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, content, sources, corrections }`; 400, 401, 403 or 500.
 */
export async function getKnowledgeDocHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const doc = await getArtistDoc(auth.artistId);
    const body = doc
      ? {
          content: doc.content,
          sources: (doc.sources as unknown[] | null) ?? [],
          corrections: await getDocCorrections(auth.artistId),
        }
      : { content: null, sources: [], corrections: [] };
    return NextResponse.json(
      { status: "ok", ...body },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[knowledge-doc] Read failed", error);
    return NextResponse.json(
      { status: "error", error: "Failed to load knowledge document" },
      { status: 500, headers },
    );
  }
}
