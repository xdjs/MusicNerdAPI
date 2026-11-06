import type { ChatEvidence } from "./ChatEvidence";
import { readPdfChatInventory } from "./readPdfChatInventory";
/** Available original-bound text only; missing statuses remain visible in the full capture inventory. */
export function readPdfChatEvidence(
  tool: "readPdfSource" | "readNamedPdf",
  toolCallId: string,
  output: unknown,
): ChatEvidence[] {
  return readPdfChatInventory(tool, toolCallId, output)?.evidence ?? [];
}
