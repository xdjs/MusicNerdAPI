import { tool } from "ai";
import { z } from "zod";
import type { ChatDocuments } from "@/lib/chat/createChatDocuments";
import { readUnits } from "@/lib/units/readUnits";

const CHANGED = { error: "Source changed or is no longer public" } as const;

/**
 * The chat's `readUnits` tool: whole units (pages) of a document `searchPassages` numbered, or the
 * whole document when no locators are given, read only while the document is still public and at
 * the revision it was numbered at. Units are returned whole and in order until the shared token
 * budget runs out; the rest are dropped. Locators the document lacks are listed in `missing`, or
 * returned as an error when none of them exist.
 *
 * @param artistId - The artist.
 * @param documents - The chat's document registry.
 * @param budget - Tokens left for reads in this answer; decremented by each unit returned.
 * @returns The tool.
 */
export function createReadUnitsTool(
  artistId: string,
  documents: ChatDocuments,
  budget: { remainingTokens: number },
) {
  return tool({
    description:
      "Read whole pages of document n when a claim needs more than the search passage: the surrounding page, or pages next to a hit. Pass n from searchPassages and up to 6 locators (e.g. `p. 4`); omit locators to read the whole document; long documents are cut at the budget. Cite what you use as [n, locator]. Reading is capped per answer; `truncated` means some pages were not returned, `missing` lists locators the document does not have.",
    inputSchema: z.object({
      n: z.number().int().min(1),
      locators: z.array(z.string().min(1).max(100)).max(6).optional(),
    }),
    execute: async ({ n, locators }) => {
      const ref = documents.get(n);
      if (!ref) return { error: "Unknown document number" };
      const read = await readUnits(
        artistId,
        { sourceKind: ref.sourceKind, sourceId: ref.sourceId },
        locators ?? [],
      );
      if (!read || read.revision !== ref.revision) return CHANGED;
      if (read.units.length === 0 && read.missing.length > 0)
        return { error: `No such locator: ${read.missing.join(", ")}` };
      const units: { locator: string; text: string }[] = [];
      let truncated = false;
      for (const unit of read.units) {
        if (unit.tokens > budget.remainingTokens) {
          truncated = true;
          break;
        }
        budget.remainingTokens -= unit.tokens;
        units.push({ locator: unit.locator, text: unit.text });
      }
      return { n, title: ref.title, units, truncated, missing: read.missing };
    },
  });
}
