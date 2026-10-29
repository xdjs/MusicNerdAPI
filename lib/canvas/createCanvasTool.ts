import { tool } from "ai";
import { specSchema, type CanvasEvidence, type CanvasRequest, type CanvasUpdate } from "./const";
import { validateCanvasSpec } from "./validateCanvasSpec";
/** Stage a complete canvas; caller emits it only after the entire model turn succeeds. */
export function createCanvasTool(
  request: CanvasRequest,
  evidence: Map<string, CanvasEvidence>,
  stage: (update: CanvasUpdate) => void,
) {
  return tool({
    description:
      "Compose the complete next persistent canvas. Keep stable IDs for existing blocks. Preserve pinned blocks exactly. Use only available evidence IDs. No facts or URLs in this spec. Choose/combine timeline, cards, media, quote and comparison; rearrange based on the visitor and prior canvas. Call once you have read the required sources.",
    inputSchema: specSchema,
    execute: async value => {
      try {
        const nextSpec = validateCanvasSpec(
          value,
          [...evidence.values()],
          request.pinnedIds,
          request.spec,
        );
        const prior = request.spec.blocks;
        const update: CanvasUpdate = {
          version: "canvas.v1",
          sessionId: request.sessionId,
          turnId: request.turnId,
          baseRevision: request.baseRevision,
          revision: request.baseRevision + 1,
          nextSpec,
          evidence: [...new Set(nextSpec.blocks.flatMap(block => block.items))].map(id =>
            evidence.get(id)!,
          ),
          changes: {
            added: nextSpec.blocks.filter(b => !prior.some(p => p.id === b.id)).map(b => b.id),
            updated: nextSpec.blocks
              .filter(b =>
                prior.some(p => p.id === b.id && JSON.stringify(p) !== JSON.stringify(b)),
              )
              .map(b => b.id),
            removed: prior.filter(p => !nextSpec.blocks.some(b => b.id === p.id)).map(p => p.id),
          },
        };
        stage(update);
        return { accepted: true, changes: update.changes };
      } catch (error) {
        return {
          accepted: false,
          error: error instanceof Error ? error.message : "Invalid composition",
          availableEvidence: [...evidence.values()].map(({ id, category, date }) => ({
            id,
            category,
            date,
          })),
          help: "Use evidence IDs, not citation numbers. quote requires category quote; source/document passages use document or cards. Keep pinned blocks exactly unchanged.",
        };
      }
    },
  });
}
