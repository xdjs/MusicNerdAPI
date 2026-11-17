import { tool } from "ai";
import { z } from "zod";
import type { ChatDocuments } from "@/lib/chat/createChatDocuments";
import { listArtistDocuments } from "@/lib/units/listArtistDocuments";

/**
 * The chat's `listDocuments` tool: the artist's documents a public read may show (at most 60:
 * vault, then evidence, then social), each with its URL, page count, its number when this chat has
 * already numbered it, and whether it is still being indexed. Listing numbers nothing.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @returns The tool.
 */
export function createListDocumentsTool(artistId: string, documents: ChatDocuments) {
  return tool({
    description:
      "List the artist's saved documents with their page counts: at most 60, vault files first, then research, then social posts, so a long list is cut short. Use it for questions about every or all documents, or what the artist has shared. A document with n can be read with readUnits; to read one without n, searchPassages for it first. `indexing` means it is not searchable yet.",
    inputSchema: z.object({}),
    execute: async () => {
      const numbered = new Map(
        documents.all().map(({ n, ref }) => [`${ref.sourceKind}:${ref.sourceId}`, n]),
      );
      const listed = await listArtistDocuments(artistId);
      return {
        documents: listed.map(doc => ({
          n: numbered.get(`${doc.sourceKind}:${doc.sourceId}`) ?? null,
          title: doc.title,
          kind: doc.sourceKind,
          url: doc.url,
          units: doc.units,
          indexing: doc.indexing,
        })),
      };
    },
  });
}
