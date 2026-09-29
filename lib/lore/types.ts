import type { ArtistRow } from "@/lib/artists/types";
import type { VaultSource } from "@/lib/vault/types";
import type { artistDocCorrections, artistInterviewAnswers } from "@/lib/db/schema";

/**
 * One numbered citation in the Lore. `url` is null for an interview answer:
 * the artist's own words have no link.
 */
export type DocSource = {
  id: number;
  kind: "vault" | "interview" | "social";
  label: string;
  url: string | null;
  /** When the source says it was published. Vault sources only. */
  publishedAt?: string | null;
};

/** What a rebuild did. "no-document" is not a failure: there was nothing to rebuild. */
export type DocRefresh = "rebuilt" | "no-document" | "failed" | "cancelled";

/** The inventory overview stored beside the document, keyed to the sources it describes. */
export type LoreSummary = { text: string; sourceKey: string };

/** Inventory metadata only: never source contents. */
export type LoreSummarySource = { id: string; title?: string | null; type?: string | null };

export type InterviewAnswerRow = typeof artistInterviewAnswers.$inferSelect;
export type DocCorrection = Pick<
  typeof artistDocCorrections.$inferSelect,
  "id" | "claim" | "correction" | "kind"
>;

/**
 * Everything the document is built from, read once. The numbered source list
 * and the prompt are both derived from this one object, so a source's [n] and
 * its material line always mean the same row.
 */
export type DocMaterial = {
  artist: ArtistRow;
  artistName: string;
  vaultSources: VaultSource[];
  answers: InterviewAnswerRow[];
  socialCollaborators: { handle: string; url: string }[];
  /** People the artist credited by role in their own captions. */
  creditedCollaborators: { subject: string; isHandle: boolean; roles: string[]; url: string }[];
  /** What the artist says they do themselves. */
  selfCredits: { role: string; url: string }[];
  /** The artist in their own words, about their work and their life. */
  artistStatements: { topic: string; quote: string; url: string }[];
  socialMusicRefs: { title: string; artist: string; url: string }[];
};
