import { catalogBlock } from "@/lib/lore/catalogBlock";
import { correctionsBlock } from "@/lib/lore/correctionsBlock";
import { gatherDocMaterial } from "@/lib/lore/gatherDocMaterial";
import { getDocCorrections } from "@/lib/lore/getDocCorrections";
import { selectSourceText } from "@/lib/lore/selectSourceText";
import { sourceAgeLabel } from "@/lib/lore/sourceAgeLabel";
import { sourceManifestBlock } from "@/lib/lore/sourceManifestBlock";
import { toSourceList } from "@/lib/lore/toSourceList";
import type { DocSource } from "@/lib/lore/types";
import { withoutAt } from "@/lib/artists/withoutAt";

/**
 * The Lore prompt: the artist's links, their Spotify catalog, the numbered
 * sources with their age, their interview answers, social signals, their
 * corrections (last, so they are the final word), then the manifest. Vault and
 * interview lines are zipped with the manifest by position, in the fixed order
 * `toSourceList` uses.
 *
 * `presetSources` is used as-is instead of numbering this read, so a caller
 * that built the manifest once hands the same ids to the document and the
 * About. A row that landed since has no id to attach to, so it can't be cited
 * rather than being mis-cited.
 *
 * @param artistId - The artist.
 * @param presetSources - The numbered sources to use, when the caller already built them.
 * @returns The artist's name, the prompt, and the numbered sources it cites.
 */
export async function buildDocContext(
  artistId: string,
  presetSources?: DocSource[],
): Promise<{ artistName: string; context: string; sources: DocSource[] }> {
  const material = await gatherDocMaterial(artistId);
  const { artist } = material;
  const sources = presetSources ?? toSourceList(material);
  const vaultIds = sources.filter(s => s.kind === "vault");
  const interviewIds = sources.filter(s => s.kind === "interview");
  const socialIds = sources.filter(s => s.kind === "social");

  const parts: string[] = [];
  if (artist.spotify)
    parts.push(`Spotify (verified identity): https://open.spotify.com/artist/${artist.spotify}`);
  if (artist.instagram) parts.push(`Instagram: https://instagram.com/${artist.instagram}`);
  if (artist.x) parts.push(`X: https://x.com/${artist.x}`);
  if (artist.soundcloud) parts.push(`SoundCloud: ${artist.soundcloud}`);
  if (artist.youtube) parts.push(`YouTube: https://youtube.com/@${withoutAt(artist.youtube)}`);

  const catalog = artist.spotify ? await catalogBlock(artist.spotify) : null;
  if (catalog) parts.push(catalog);

  if (material.vaultSources.length > 0) {
    // Zipped by position, as in MusicNerdWeb. Known issue carried over: the
    // manifest is ranked by byAuthority and this list is newest-first, so when
    // ranking reorders them a line can carry another source's id.
    const sourceContext = material.vaultSources
      .map((s, i) => {
        const p = [
          `[${vaultIds[i]?.id}] Source (${sourceAgeLabel(s.publishedAt)}): ${s.title ?? s.url}`,
        ];
        if (s.snippet) p.push(s.snippet);
        if (s.extractedText) p.push(selectSourceText(s.extractedText, artist.name ?? ""));
        return p.join(" — ");
      })
      .join("\n");
    parts.push(
      `\n--- APPROVED SOURCES (about this exact artist) ---\n${sourceContext}\n--- END SOURCES ---`,
    );
  }

  if (material.answers.length > 0) {
    const interviewContext = material.answers
      .map(
        (a, i) =>
          `[${interviewIds[i]?.id}] Q: ${a.question}\nA (artist's own words): "${a.answer}"`,
      )
      .join("\n\n");
    parts.push(
      `\n--- INTERVIEW ANSWERS (quote verbatim) ---\n${interviewContext}\n--- END INTERVIEW ---`,
    );
  }

  if (socialIds.length > 0) {
    const socialContext = socialIds.map(s => `[${s.id}] ${s.label}`).join("\n");
    parts.push(
      `\n--- SOCIAL SIGNALS (confirmed collaborations / track credits) ---\n${socialContext}\n--- END SOCIAL SIGNALS ---`,
    );
  }

  const corrections = correctionsBlock(await getDocCorrections(artistId));
  if (corrections) parts.push(corrections);

  parts.push(sourceManifestBlock(sources));
  return { artistName: material.artistName, context: parts.join("\n"), sources };
}
