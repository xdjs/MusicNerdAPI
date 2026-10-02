import { gatherDocMaterial } from "@/lib/lore/gatherDocMaterial";
import { toSourceList } from "@/lib/lore/toSourceList";
import type { DocSource } from "@/lib/lore/types";

/**
 * The artist's numbered sources, with no model call: what the onboarding
 * publish builds once and hands to both the document and the About, so a
 * source landing between the two calls can't shift the ids under either.
 *
 * @param artistId - The artist.
 * @returns The numbered sources.
 */
export async function buildDocSources(artistId: string): Promise<DocSource[]> {
  return toSourceList(await gatherDocMaterial(artistId));
}
