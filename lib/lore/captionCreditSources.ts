import { creditedCollaborators } from "@/lib/credits/creditedCollaborators";
import { getSocialCredits } from "@/lib/credits/getSocialCredits";
import { selfCredits } from "@/lib/credits/selfCredits";
import {
  MAX_COLLABORATOR_SOURCES,
  MAX_SELF_CREDIT_SOURCES,
  MAX_STATEMENT_SOURCES,
} from "@/lib/lore/const";
import type { DocMaterial } from "@/lib/lore/types";

/**
 * What the artist's own captions say, worth citing: people credited by role (a
 * stronger claim than a bare mention, and the only collaboration evidence for
 * an artist who never uses coauthor tags), their own roles, and their own
 * words about their work and life.
 *
 * @param artistId - The artist.
 * @returns The three lists, capped; empty when the credits cannot be read.
 */
export async function captionCreditSources(
  artistId: string,
): Promise<Pick<DocMaterial, "creditedCollaborators" | "selfCredits" | "artistStatements">> {
  try {
    const extraction = await getSocialCredits(artistId);
    return {
      creditedCollaborators: creditedCollaborators(extraction)
        .filter(c => c.evidenceUrls[0])
        .slice(0, MAX_COLLABORATOR_SOURCES)
        .map(c => ({
          subject: c.subject,
          isHandle: c.isHandle,
          roles: c.roles,
          url: c.evidenceUrls[0],
        })),
      selfCredits: selfCredits(extraction)
        .slice(0, MAX_SELF_CREDIT_SOURCES)
        .map(c => ({ role: c.role, url: c.url })),
      artistStatements: extraction.statements
        .slice(0, MAX_STATEMENT_SOURCES)
        .map(s => ({ topic: s.topic, quote: s.quote, url: s.url })),
    };
  } catch (e) {
    console.error("[captionCreditSources] Error:", e);
    return { creditedCollaborators: [], selfCredits: [], artistStatements: [] };
  }
}
