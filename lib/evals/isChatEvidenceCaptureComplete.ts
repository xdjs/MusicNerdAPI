/** Whether one tool output is fully represented by this evaluator's text evidence. */
export function isChatEvidenceCaptureComplete(
  tool: string | undefined,
  output: unknown,
  capturedCount: number,
): boolean {
  if (tool === "searchSources" || tool === "searchPdfSources") return true;
  if (!output || typeof output !== "object") return false;
  const record = output as Record<string, unknown>;
  const failedRead = typeof record.error === "string" && record.n === undefined;
  if (tool === "readSource") return failedRead || capturedCount === 1;
  if (tool === "webSearch")
    return Array.isArray(record.results) && record.results.length === capturedCount;
  if (tool === "readPdfSource" || tool === "readNamedPdf") return failedRead;
  return false;
}
