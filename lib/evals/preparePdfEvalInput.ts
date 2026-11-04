import { createHash } from "node:crypto";
import type { LanguageModelMiddleware } from "ai";
import type { PdfEvalDocument } from "./pdfEvalTypes";

type Params = Parameters<NonNullable<LanguageModelMiddleware["wrapStream"]>>[0]["params"];

/** Validate existing tool-produced file parts; build hash-reference evidence without mutating model input. */
export function preparePdfEvalInput(
  prepared: Omit<Params, "abortSignal" | "headers">,
  successfulReads: ReadonlyMap<string, PdfEvalDocument>,
) {
  const documents: PdfEvalDocument[] = [];
  const files: { document: PdfEvalDocument; bytes: Buffer }[] = [];
  const prompt = prepared.prompt.map(message => {
    if (!Array.isArray(message.content)) return message;
    return {
      ...message,
      content: message.content.map(part => {
        if (
          !["text", "tool-call", "tool-result", "reasoning"].includes(part.type) &&
          !(part.type === "custom" && part.kind === "anthropic.message_start")
        )
          throw new Error("eval_nontext_input");
        if (part.type !== "tool-result" || part.output.type !== "content") return part;
        return {
          ...part,
          output: {
            ...part.output,
            value: part.output.value.map(item => {
              if (item.type === "text") return item;
              const document = successfulReads.get(part.toolCallId);
              if (
                !document ||
                !["readPdfSource", "readNamedPdf"].includes(part.toolName) ||
                item.type !== "file" ||
                item.mediaType !== "application/pdf" ||
                item.filename !== document.filename ||
                item.data.type !== "data"
              )
                throw new Error("eval_pdf_identity");
              let bytes: Buffer;
              const data = item.data.data;
              if (typeof data === "string") {
                if (
                  data.length !== 4 * Math.ceil(document.bytes / 3) ||
                  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)
                )
                  throw new Error("eval_pdf_encoding");
                bytes = Buffer.from(data, "base64");
                if (bytes.toString("base64") !== data) throw new Error("eval_pdf_encoding");
              } else if (data instanceof Uint8Array && data.byteLength === document.bytes) {
                bytes = Buffer.from(data);
              } else throw new Error("eval_pdf_encoding");
              if (
                bytes.length !== document.bytes ||
                bytes.subarray(0, 5).toString() !== "%PDF-" ||
                createHash("sha256").update(bytes).digest("hex") !== document.sha256
              )
                throw new Error("eval_pdf_identity");
              documents.push(document);
              files.push({ document, bytes });
              return {
                type: "pdf-reference",
                sourceId: document.sourceId,
                revision: document.revision,
                filename: document.filename,
                sha256: document.sha256,
                bytes: document.bytes,
                pages: document.pages,
              };
            }),
          },
        };
      }),
    };
  });
  return {
    prepared: { ...prepared, prompt },
    documents,
    files,
    pdfBytes: documents.reduce((n, d) => n + d.bytes, 0),
    pdfPages: documents.reduce((n, d) => n + d.pages, 0),
  };
}
