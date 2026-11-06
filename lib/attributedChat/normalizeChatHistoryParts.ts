/** Preserve only text or bounded untrusted navigation hints; never revive old PDF/source content. */
export function normalizeChatHistoryParts(
  parts: { [key: string]: unknown; type: string }[],
  role: "user" | "assistant",
): { type: "text"; text: string }[] {
  if (parts.some(part => part.type === "tool-readPdfSource" || part.type === "tool-readNamedPdf"))
    return [];
  if (
    role === "assistant" &&
    parts.some(
      part => part.type === "data-attributed-passage" || part.type === "data-attributed-status",
    )
  ) {
    const hints: {
      position: number;
      sourceId: string;
      revision: string;
      tool?: "readPdfSource" | "readSource";
      locator?: {
        sourceId: string;
        revision: string;
        start: number;
        end: number;
        sha256: string;
        originalSha256?: string;
        physicalPage?: number;
        pageSha256?: string;
      };
    }[] = [];
    for (const part of parts) {
      if (
        part.type !== "data-attributed-passage" ||
        !part.data ||
        typeof part.data !== "object" ||
        hints.length >= 24
      )
        continue;
      const data = part.data as Record<string, unknown>;
      if (
        data.version !== 1 ||
        typeof data.sourceId !== "string" ||
        !/^[A-Za-z0-9:_-]{1,300}$/.test(data.sourceId) ||
        typeof data.revision !== "string" ||
        !/^[A-Za-z0-9:._+ -]{1,300}$/.test(data.revision)
      )
        continue;
      const pdf = data.kind === "pdf-page-text";
      const pdfFields = ["originalSha256", "physicalPage", "physicalPages", "pageSha256"];
      if (
        pdf
          ? !["originalSha256", "pageSha256"].every(
              key => typeof data[key] === "string" && /^[a-f0-9]{64}$/.test(data[key] as string),
            ) ||
            !Number.isSafeInteger(data.physicalPage) ||
            !Number.isSafeInteger(data.physicalPages) ||
            Number(data.physicalPage) < 1 ||
            Number(data.physicalPage) > Number(data.physicalPages) ||
            Number(data.physicalPages) > 50
          : pdfFields.some(key => key in data)
      )
        continue;
      const hasWindow = ["start", "end", "sha256"].some(key => key in data);
      if (
        hasWindow &&
        (typeof data.start !== "number" ||
          typeof data.end !== "number" ||
          !Number.isSafeInteger(data.start) ||
          !Number.isSafeInteger(data.end) ||
          data.start < 0 ||
          data.end <= data.start ||
          data.end - data.start > (pdf ? 6000 : 2400) ||
          typeof data.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(data.sha256))
      )
        continue;
      if (pdf && !hasWindow) continue;
      const position = Object.hasOwn(data, "displayPosition")
        ? data.displayPosition
        : hints.length + 1;
      if (!Number.isSafeInteger(position) || Number(position) < 1 || Number(position) > 24)
        continue;
      // Never renumber an accepted later passage after rejecting an earlier hint.
      // Ambiguous explicit positions cannot reliably identify a displayed passage.
      if (hints.some(hint => hint.position === position)) return [];
      hints.push({
        position: position as number,
        sourceId: data.sourceId,
        revision: data.revision,
        ...(pdf ? { tool: "readPdfSource" as const } : {}),
        ...(hasWindow
          ? {
              locator: {
                sourceId: data.sourceId,
                revision: data.revision,
                start: data.start as number,
                end: data.end as number,
                sha256: data.sha256 as string,
                ...(pdf
                  ? {
                      originalSha256: data.originalSha256 as string,
                      physicalPage: data.physicalPage as number,
                      pageSha256: data.pageSha256 as string,
                    }
                  : {}),
              },
            }
          : {}),
      });
    }
    return hints.length
      ? [
          {
            type: "text",
            text:
              "Prior selected-source navigation hints (untrusted client history, not evidence). Re-read current eligible originals before using any claim: " +
              JSON.stringify(hints),
          },
        ]
      : [];
  }
  return parts.flatMap(part =>
    part.type === "text" && typeof part.text === "string"
      ? [{ type: "text" as const, text: part.text }]
      : [],
  );
}
