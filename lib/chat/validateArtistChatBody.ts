import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_CHAT_PDF_READS } from "@/lib/chatPdf/types";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MAX_MESSAGES = 12;
/** Parts per message: an answer is a few tool steps, their sources and text; this bounds the work on a hostile body. */
const MAX_PARTS = 64;
/** Documents one answer may cite: what its searches numbered, each document once. */
const MAX_DOCUMENTS = 16;
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
  n: z.number().int().min(1).max(64),
  sourceKind: z.enum(["vault", "social", "evidence"]),
  sourceId: z.uuid(),
  revision: z.string().min(1).max(300),
  title: z.string().min(1).max(300),
  url: z.string().nullable(),
});
/** `searchPassages` always lists the documents it numbered; `readUnits` reads documents already
 * numbered and today lists none, so `documents` is optional there. */
const documentParts = {
  "tool-searchPassages": z.object({
    state: z.literal("output-available"),
    output: z.object({ documents: z.array(documentRef).max(MAX_DOCUMENTS) }),
  }),
  "tool-readUnits": z.object({
    state: z.literal("output-available"),
    output: z.object({ documents: z.array(documentRef).max(MAX_DOCUMENTS).optional() }),
  }),
};
type DocumentRef = z.infer<typeof documentRef>;

/**
 * The documents an answer's completed searches and reads numbered, the first of each
 * `(sourceKind, sourceId)`; null when one cannot be identified or there are more than 16.
 */
function citedDocuments(parts: { type: string; state?: unknown }[]): DocumentRef[] | null {
  const byKey = new Map<string, DocumentRef>();
  for (const part of parts) {
    if (part.type !== "tool-searchPassages" && part.type !== "tool-readUnits") continue;
    // A call that did not complete numbered nothing the answer could cite.
    if (part.state !== "output-available") continue;
    const parsed = documentParts[part.type].safeParse(part);
    if (!parsed.success) return null;
    for (const ref of parsed.data.output.documents ?? []) {
      const key = `${ref.sourceKind}:${ref.sourceId}`;
      if (!byKey.has(key)) byKey.set(key, ref);
    }
  }
  return byKey.size > MAX_DOCUMENTS ? null : [...byKey.values()];
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
    // must all be identified, and at most 16, or the answer is not replayed.
    const documents = citedDocuments(parts);
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
 * cite (at most 16), for `keepCurrentCitedTurns`.
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
