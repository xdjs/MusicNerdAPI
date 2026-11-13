import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_CHAT_PDF_READS } from "@/lib/chatPdf/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MAX_MESSAGES = 12;
/** Parts per message: an answer is a few tool steps, their sources and text; this bounds the work on a hostile body. */
const MAX_PARTS = 64;
/** Documents one answer may carry: six steps of eight search hits, each document once. */
const MAX_DOCUMENTS = 48;
/** The highest document number a long conversation can reach. */
const MAX_DOCUMENT_N = 256;
const question = z.string().trim().min(1).max(500);

const textPart = z.object({ type: z.literal("text"), text: z.string() });
/** A completed PDF read as the client sends it back: enough to ask whether that document is still what it was. */
const pdfReadPart = z.object({
  type: z.enum(["tool-readPdfSource", "tool-readNamedPdf"]),
  state: z.literal("output-available"),
  output: z.object({ sourceId: z.uuid(), revision: z.string().min(1).max(300) }),
});
const isPdfRead = (part: { type: string }) =>
  part.type === "tool-readPdfSource" || part.type === "tool-readNamedPdf";

/** A document a search numbered, as the tool output names it: enough to check it and to number it again. */
const documentRef = z.object({
  n: z.number().int().min(1).max(MAX_DOCUMENT_N),
  sourceKind: z.enum(["vault", "social", "evidence"]),
  sourceId: z.uuid(),
  revision: z.string().min(1).max(300),
  title: z.string().min(1).max(300),
  url: z.string().nullable(),
});
const documentList = z.array(documentRef).max(MAX_DOCUMENTS);
/** `searchPassages` always lists the documents it numbered; `readUnits` lists the document it read
 * whenever it returned units. A read that returned none (an error) read nothing to replay. */
const listsDocuments = z.object({
  state: z.literal("output-available"),
  output: z.object({ documents: documentList }),
});
const mayListDocuments = z.object({
  state: z.literal("output-available"),
  output: z.object({ documents: documentList.optional() }),
});
const readReturnedUnits = (part: { output?: unknown }) =>
  typeof part.output === "object" && part.output !== null && "units" in part.output;
type DocumentRef = z.infer<typeof documentRef>;

/**
 * The documents an answer's completed searches and reads numbered, the first of each
 * `(sourceKind, sourceId)`, at most the first 48; null when one cannot be identified.
 */
function citedDocuments(
  parts: { type: string; state?: unknown; output?: unknown }[],
): DocumentRef[] | null {
  const byKey = new Map<string, DocumentRef>();
  for (const part of parts) {
    if (part.type !== "tool-searchPassages" && part.type !== "tool-readUnits") continue;
    // A call that did not complete numbered nothing the answer could cite.
    if (part.state !== "output-available") continue;
    const schema =
      part.type === "tool-searchPassages" || readReturnedUnits(part)
        ? listsDocuments
        : mayListDocuments;
    const parsed = schema.safeParse(part);
    if (!parsed.success) return null;
    for (const ref of parsed.data.output.documents ?? []) {
      const key = `${ref.sourceKind}:${ref.sourceId}`;
      if (!byKey.has(key)) byKey.set(key, ref);
    }
  }
  return [...byKey.values()].slice(0, MAX_DOCUMENTS);
}

const message = z
  .object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    // Tool, source and step parts are the client's record of earlier turns; only their text is context.
    parts: z.array(z.looseObject({ type: z.string() })).max(MAX_PARTS),
  })
  .transform(({ id, role, parts }) => {
    const reads = parts.filter(isPdfRead).map(part => pdfReadPart.safeParse(part));
    // An earlier answer that read a PDF is replayed only if every read can be checked
    // against the document's current publication (keepCurrentPdfTurns); one that cannot be
    // identified, or claims more reads than the tool allows, is not replayed at all, since
    // access can have changed since. The cap also bounds the lookups a hostile body can cause.
    if (reads.length > MAX_CHAT_PDF_READS || reads.some(read => !read.success))
      return { id, role, parts: [] };
    // The same for an answer from the document tools (keepCurrentCitedTurns): its documents
    // must all be identified, or the answer is not replayed; past 48 it keeps the first 48. Only answers cite;
    // tool parts on a user message are ignored, so they can never empty the question.
    const documents = role === "assistant" ? citedDocuments(parts) : [];
    if (!documents) return { id, role, parts: [] };
    const text = parts.flatMap(part => {
      const parsed = textPart.safeParse(part);
      return parsed.success ? [{ type: "text" as const, text: parsed.data.text }] : [];
    });
    const pdfReads = reads.flatMap(read => (read.success ? [read.data.output] : []));
    return {
      id,
      role,
      parts: text,
      ...(pdfReads.length ? { pdfReads } : {}),
      ...(documents.length ? { documents } : {}),
    };
  });

const chatBodySchema = z
  .object({
    messages: z
      .array(message)
      .min(1)
      .transform(messages => messages.slice(-MAX_MESSAGES)),
  })
  .strict()
  .refine(({ messages }) => {
    const last = messages.at(-1);
    if (!last) return false;
    const text = last.parts.map(part => part.text).join("\n");
    return last.role === "user" && question.safeParse(text).success;
  })
  .transform(({ messages }) => ({
    messages: messages.filter(message => message.role !== "assistant" || message.parts.length > 0),
  }));

export type ArtistChatBody = z.infer<typeof chatBodySchema>;

/**
 * Reads a chat body: `{ messages: UIMessage[] }` whose last message is the
 * visitor's question, at most 500 characters. Keeps the last 12
 * messages and only their text parts. An assistant message that read a PDF
 * also carries `pdfReads`, the documents and revisions it depends on, for
 * `keepCurrentPdfTurns` to check before the model sees it; one that searched the
 * artist's documents carries `documents`, the numbered documents and revisions it may
 * cite (the first 48), for `keepCurrentCitedTurns`.
 *
 * @param request - The chat request.
 * @returns The messages, or a 400 response.
 */
export async function validateArtistChatBody(
  request: Request,
): Promise<ArtistChatBody | NextResponse> {
  const parsed = chatBodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid chat request" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  return parsed.data;
}
