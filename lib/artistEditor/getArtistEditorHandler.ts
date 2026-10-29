import { NextResponse } from "next/server";
import { addSourceContributors } from "@/lib/artistEditor/addSourceContributors";
import { getArtistById } from "@/lib/artists/getArtistById";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";

/**
 * Handles GET /api/artist/{id}/editor: what the claimant or an admin edits on
 * the artist page. The About as stored (visitors of an unclaimed artist see a
 * public one), and every approved and pending source in full with its
 * contributor's name, as MusicNerdWeb's artist page loaded them for an editor.
 *
 * @param request - The request; the claimant's or an admin's Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, bio, approvedSources, pendingSources }`; 400, 401, 403, 404 or 500.
 */
export async function getArtistEditorHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const artist = await getArtistById(auth.artistId);
    if (!artist)
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    const [approved, pending] = await Promise.all([
      getVaultSourcesByStatus(auth.artistId, "approved"),
      getVaultSourcesByStatus(auth.artistId, "pending"),
    ]);
    const sources = await addSourceContributors(auth.artistId, [...approved, ...pending]);
    return NextResponse.json(
      {
        status: "ok",
        bio: artist.bio,
        approvedSources: sources.slice(0, approved.length),
        pendingSources: sources.slice(approved.length),
      },
      { headers },
    );
  } catch (e) {
    console.error("[artist/editor] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
