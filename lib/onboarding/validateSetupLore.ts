import { publicKnowledgeUrl } from "@/lib/knowledge/publicKnowledgeUrl";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import type { DocSource } from "@/lib/lore/types";
import { LoreChangedError } from "@/lib/lore/LoreChangedError";
import { assertAboutLoreCurrent } from "@/lib/bio/assertAboutLoreCurrent";
import { assertSetupDocumentCurrent } from "@/lib/onboarding/assertSetupDocumentCurrent";

/** Validate existing Lore before reuse; never replace or fabricate its saved manifest. */
export async function validateSetupLore(
  artistId: string,
  ownership: ArtistWriteAuth,
  document: { content: string; sources: unknown; updatedAt: string | null },
): Promise<DocSource[]> {
  const sources = document.sources;
  if (
    !Array.isArray(sources) ||
    !sources.length ||
    sources.some(
      s =>
        !s ||
        typeof s !== "object" ||
        !Number.isSafeInteger(s.id) ||
        s.id <= 0 ||
        typeof s.label !== "string" ||
        !["vault", "interview", "social"].includes(s.kind) ||
        (s.url !== null && (typeof s.url !== "string" || !publicKnowledgeUrl(s.url))) ||
        (s.kind === "vault" &&
          (typeof s.revision !== "string" || !/^[a-f0-9]{64}$/.test(s.revision))),
    )
  )
    throw new LoreChangedError();
  if (new Set(sources.map(s => s.id)).size !== sources.length) throw new LoreChangedError();
  await db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, ownership);
    await assertSetupDocumentCurrent(tx, artistId, document);
    await assertAboutLoreCurrent(tx, artistId, { content: document.content, sources });
  });
  return sources;
}
