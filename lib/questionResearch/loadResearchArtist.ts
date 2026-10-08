import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
/** Strict current identity read; a storage failure cannot masquerade as an unknown artist. */
export async function loadResearchArtist(artistId: string) {
  const artist = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });
  if (!artist) throw new KnowledgeError("not_found", 404, "Artist unavailable");
  return artist;
}
