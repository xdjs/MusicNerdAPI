import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const MAX_MESSAGES = 12;
/** Readable parts per message (text and tool parts): an answer is a few tool steps and its text; this bounds the work on a hostile body. */
const MAX_PARTS = 64;
/** Raw parts per message, before unread ones (`source-url`, `step-start`, `reasoning`, ...) are discarded. */
const MAX_RAW_PARTS = 512;
/** The API only reads text and tool parts; every other part is dropped before any limit applies. */
const isReadPart = ({ type }: { type: string }) => type === "text" || type.startsWith("tool-");
/** Documents one answer may carry: four searches (the tool's cap) of `SEARCH_LIMIT` hits each, each document once. */
const MAX_DOCUMENTS = 48;
/** The highest document number a long conversation can reach. */
const MAX_DOCUMENT_N = 256;
const question = z.string().trim().min(1).max(500);

const textPart = z.object({ type: z.literal("text"), text: z.string() });
/** A read by the PDF tools the chat no longer has; an open tab can still send one back. */
const isPdfRead = (part: { type: string }) =>
  part.type === "tool-readPdfSource" || part.type === "tool-readNamedPdf";

/** A document a search numbered, as the tool output names it: enough to check it and to number it
 * again. Other fields of the output's entry (`units`, `shown`) are not needed for replay: they may be
 * present or not, and are dropped. */
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
/** A search refused at the per-answer cap returns an error and numbers nothing. */
const searchRefused = (part: { output?: unknown }) =>
  typeof part.output === "object" && part.output !== null && "error" in part.output;
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
      (part.type === "tool-searchPassages" && !searchRefused(part)) || readReturnedUnits(part)
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
    // The API re-sends a source-url part for every earlier document, so parts it never reads are
    // discarded first and the limit counts what remains.
    parts: z
      .array(z.looseObject({ type: z.string() }))
      .max(MAX_RAW_PARTS)
      .transform(parts => parts.filter(isReadPart))
      .pipe(z.array(z.looseObject({ type: z.string() })).max(MAX_PARTS)),
  })
  .transform(({ id, role, parts }) => {
    // An answer from the removed PDF tools cannot be checked against the documents' current
    // publication any more, so it is not replayed.
    if (parts.some(isPdfRead)) return { id, role, parts: [] };
    // An answer from the document tools (keepCurrentCitedTurns) must have all its documents
    // identified, or it is not replayed; past 48 it keeps the first 48. Only answers cite;
    // tool parts on a user message are ignored, so they can never empty the question.
    const documents = role === "assistant" ? citedDocuments(parts) : [];
    if (!documents) return { id, role, parts: [] };
    const text = parts.flatMap(part => {
      const parsed = textPart.safeParse(part);
      return parsed.success ? [{ type: "text" as const, text: parsed.data.text }] : [];
    });
    return {
      id,
      role,
      parts: text,
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
 * messages and only their text parts. An assistant message that searched the
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
