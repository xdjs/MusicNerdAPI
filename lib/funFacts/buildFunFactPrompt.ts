import type { ArtistRow } from "@/lib/artists/types";
import { getArtistDocContext } from "@/lib/lore/getArtistDocContext";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";

/**
 * The fun fact prompt, as MusicNerdWeb assembled it: the kind's stored prompt
 * with `ARTIST_NAME` and `SPOTIFY_ID` filled in, then, for a claimed artist,
 * the approved vault sources and the Lore document as context. A failed
 * context read is logged and the prompt goes without it.
 *
 * @param basePrompt - The stored prompt for the kind of fact.
 * @param artist - The artist; the name and Spotify id fill the placeholders.
 * @param publicLoreAllowed - Whether the artist has an approved claim, which releases the context.
 * @returns The prompt to send.
 */
export async function buildFunFactPrompt(
  basePrompt: string,
  artist: Pick<ArtistRow, "id" | "name" | "spotify">,
  publicLoreAllowed: boolean,
): Promise<string> {
  let finalPrompt = basePrompt.replace("ARTIST_NAME", artist.name ?? "");
  if (artist.spotify) {
    finalPrompt = finalPrompt.replace("SPOTIFY_ID", artist.spotify);
  }

  try {
    const vaultSources = publicLoreAllowed
      ? await getVaultSourcesByStatus(artist.id, "approved")
      : [];
    if (vaultSources.length > 0) {
      const vaultContext = vaultSources
        .map(s => {
          const parts = [`Source: ${s.title ?? s.url}`];
          if (s.snippet) parts.push(s.snippet);
          if (s.extractedText) parts.push(s.extractedText.slice(0, 1000));
          return parts.join(" — ");
        })
        .join("\n");
      finalPrompt += `\n\nAdditional context provided by the artist:\n${vaultContext}`;
    }
  } catch (e) {
    console.error("Error fetching vault sources for fun facts:", e);
  }

  // The document's "Story hooks" section is exactly what fun facts want.
  try {
    const docContext = publicLoreAllowed ? await getArtistDocContext(artist.id) : null;
    if (docContext) {
      finalPrompt += `\n\nArtist knowledge doc (compiled with the artist — prefer its "Story hooks"):\n${docContext}`;
    }
  } catch (e) {
    console.error("Error fetching artist doc for fun facts:", e);
  }

  return finalPrompt;
}
