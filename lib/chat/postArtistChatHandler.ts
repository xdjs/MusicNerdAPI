import { getChatCorpusFingerprint } from "./getChatCorpusFingerprint";
import { getAttributedTextLimit } from "@/lib/chat/getAttributedTextLimit";
import { assertPublicSourceCurrent } from "@/lib/sourcePublication/assertPublicSourceCurrent";
import { randomUUID } from "node:crypto";
import { createExposedSourceValidator } from "@/lib/attributedChat/createExposedSourceValidator";
import { registerPdfPages } from "@/lib/attributedChat/registerPdfPages";
import type { ReadOriginal } from "@/lib/attributedChat/types";
import type { PdfRegisteredSelection } from "@/lib/chatPdf/types";
import { createAttributionRegistry } from "@/lib/attributedChat/createAttributionRegistry";
import { getAttributionFamily } from "@/lib/attributedChat/getAttributionFamily";
import { transformAttributedStream } from "@/lib/attributedChat/transformAttributedStream";
import type { UIMessageStreamWriter, UIMessageChunk } from "ai";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MODEL_CHAT } from "@/lib/ai/const";
import { streamText } from "@/lib/ai/streamText";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { createChatCitations } from "@/lib/chat/createChatCitations";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { createWebSearchTool } from "@/lib/chat/createWebSearchTool";
import { createChatPdfTools } from "@/lib/chatPdf/createChatPdfTools";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { questionQuotaResponse } from "@/lib/questionResearch/questionQuotaResponse";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";

/**
 * One chat turn about an artist: spends one question from the hourly
 * allowance, then streams the answer as an AI SDK UI message stream. The
 * model searches and reads the artist's stored public sources (and the web
 * when they can't answer) and cites them as `[n]`, matching the
 * `source-url` parts.
 *
 * @param request - `{ messages: UIMessage[] }`, with an optional Privy bearer token.
 * @param artistId - The artist's id from the path.
 * @returns The stream, or a 400, 404, 429 or 503 error.
 */
export async function postArtistChatHandler(
  request: Request,
  artistId: string,
  executeStream: typeof streamText = streamText,
  observeToolEvent?: (part: UIMessageChunk) => void,
) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const body = await validateArtistChatBody(request);
    if (body instanceof NextResponse) return body;
    const maxTextCharacters = getAttributedTextLimit(request);
    if (!z.uuid().safeParse(artistId).success) return fail("Artist not found", 404);
    let artist: Awaited<ReturnType<typeof loadResearchArtist>>;
    try {
      artist = await loadResearchArtist(artistId);
    } catch (error) {
      if (error instanceof KnowledgeError && error.code === "not_found")
        return fail("Artist not found", 404);
      throw error;
    }
    await reserveQuestionPlanning(artistId, await getQuestionVisitorKey(request));
    const originals = await loadPublicResearchOriginals(artistId);
    // Trusted in-process capture only: never written to the HTTP/UI stream.
    if (observeToolEvent)
      observeToolEvent({
        type: "data-chat-corpus-pin",
        data: { sha256: getChatCorpusFingerprint(originals) },
      });
    const name = artist.name ?? "This artist";
    const question = body.messages
      .at(-1)!
      .parts.map(part => part.text)
      .join("\n");
    const family = getAttributionFamily(
      question,
      body.messages
        .slice(0, -1)
        .filter(message => message.role === "user")
        .map(message => message.parts.map(part => part.text).join("\n")),
    );
    const prompt = await convertToModelMessages(body.messages);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const stopSelection = new AbortController();
        const signal =
          family || observeToolEvent
            ? AbortSignal.any([request.signal, stopSelection.signal])
            : request.signal;
        const observe = (part: UIMessageChunk) => {
          if (
            !observeToolEvent ||
            ![
              "source-url",
              "tool-input-start",
              "tool-input-available",
              "tool-output-available",
              "tool-output-error",
            ].includes(part.type)
          )
            return;
          try {
            observeToolEvent(part);
          } catch {
            stopSelection.abort();
            throw new Error("Evidence capture failed");
          }
        };
        const exposedOriginals = new Map<string, ResearchOriginal>();
        const exposureValidator = family
          ? createExposedSourceValidator({
              initialSources: originals,
              loadCurrent: () => loadPublicResearchOriginals(artistId),
              assertLegacy: source => assertPublicSourceCurrent(artistId, source),
            })
          : undefined;
        const validateExposures = async (sources: ResearchOriginal[]) => {
          const batch = new Map(exposedOriginals);
          for (const source of sources) batch.set(source.sourceId, source);
          if (exposureValidator) {
            await exposureValidator.validate([...batch.values()]);
            await pdf.assertCurrent();
          } else
            await Promise.all(sources.map(source => assertPublicSourceCurrent(artistId, source)));
          for (const source of sources) exposedOriginals.set(source.sourceId, source);
        };
        const validateExposure = (source: ResearchOriginal) => validateExposures([source]);
        const validateSelected = async (selected: ReadOriginal[]) => {
          for (const item of selected) {
            if (item.kind === "pdf-page-text") continue;
            const source = exposedOriginals.get(item.sourceId);
            if (!source || source.revision !== item.revision)
              throw new Error("Source revision unavailable");
          }
          // One fresh all-exposed check per selection boundary, not per passage.
          await exposureValidator!.validate([...exposedOriginals.values()]);
          await pdf.assertRegistered(
            selected.filter(item => item.kind === "pdf-page-text") as PdfRegisteredSelection[],
          );
        };
        const registry = family
          ? createAttributionRegistry({
              artistId,
              turnId: randomUUID(),
              maxTextCharacters,
              assertCurrent: selected => validateSelected([selected]),
              assertCurrentBatch: validateSelected,
            })
          : undefined;
        // Intercept before streamText's merge. The ordinary writer remains untouched.
        const outputWriter: UIMessageStreamWriter = registry
          ? {
              write: part => {
                observe(part); /* Raw metadata is not an attributed answer. */
              },
              merge: input =>
                writer.merge(
                  transformAttributedStream(input, {
                    registry,
                    maxTextCharacters,
                    signal: request.signal,
                    onFailure: () => stopSelection.abort(),
                    observeToolEvent: observe,
                  }),
                ),
              onError: writer.onError,
            }
          : observeToolEvent
            ? {
                write: part => {
                  observe(part);
                  writer.write(part);
                },
                merge: input =>
                  writer.merge(
                    input.pipeThrough(
                      new TransformStream({
                        transform(part, controller) {
                          observe(part);
                          controller.enqueue(part);
                        },
                      }),
                    ),
                  ),
                onError: writer.onError,
              }
            : writer;
        const cite = createChatCitations(outputWriter);
        const pdf = createChatPdfTools(
          artistId,
          cite,
          signal,
          question,
          registry
            ? {
                onVerifiedTextRead: (source, manifest, citation) =>
                  registerPdfPages(registry, source, manifest, citation),
                onTextUnavailable: () => {
                  registry.notePdfUnavailable();
                },
              }
            : undefined,
        );
        const readSource = createReadSourceTool(originals, cite, validateExposure);
        if (registry) {
          const executeRead = readSource.execute!;
          readSource.execute = async (input, options) => {
            const output = await executeRead(input, options);
            if (output && typeof output === "object" && Symbol.asyncIterator in output)
              throw new Error("Streaming source output has no verified literal window");
            if (!output || !("text" in output) || typeof output.text !== "string") return output;
            const source = originals.find(item => item.sourceId === input.sourceId);
            if (!source) throw new Error("Read original unavailable");
            return { ...output, ...registry.registerTextRead(source, output) };
          };
          // Tool events retain the full server provenance for strict capture. Only
          // the provider-facing serialization omits repeated per-block metadata.
          readSource.toModelOutput = ({ output }) => {
            if (!("text" in output)) return { type: "text", value: JSON.stringify(output) };
            const captured = output as typeof output & {
              blocks: {
                id: string;
                start: number;
                end: number;
                preview: string;
                contextIncomplete: boolean;
              }[];
              limitation: string;
            };
            return {
              type: "text",
              value: JSON.stringify({
                sourceId: captured.sourceId,
                revision: captured.revision,
                n: captured.n,
                title: captured.title,
                url: captured.url,
                start: captured.start,
                end: captured.end,
                text: captured.text,
                truncated: captured.truncated,
                sourceTruncated: captured.sourceTruncated,
                publishedAt: captured.publishedAt,
                activityDate: captured.activityDate,
                retrievedAt: captured.retrievedAt,
                blocks: captured.blocks.map(({ id, start, end, preview, contextIncomplete }) => ({
                  id,
                  start,
                  end,
                  preview,
                  contextIncomplete,
                })),
                limitation: captured.limitation,
              }),
            };
          };
        }
        await executeStream({
          model: MODEL_CHAT,
          // Keep the current target's effort setting; no speculative effort change in this composition.
          anthropicEffort: "low",
          instructions:
            buildArtistChatInstructions(name) +
            (family
              ? `\nFor this ${family} request, select source wording instead of composing an answer. Keep using the same tools as needed. readSource and verified PDF reads return server-owned IDs for exact source contexts, with offsets and physical PDF page identity where applicable. Read the source text to choose directly responsive bundles, not irrelevant article dumps. Use at most ${maxTextCharacters} literal UTF-16 text characters total, with up to24 passages as a resource bound rather than a semantic omission target. Full physical-page text can be selected when it fits; preserve all required accounts, headings and qualifications across pages. Excerpts may omit governing context: retain nearby qualifications, use another bundle if needed, and do not treat captured reads as the whole corpus. Emit only newline-delimited JSON records of the form {"blocks":["ID"]}, followed by {"end":true}. Use only IDs actually returned in this turn. Do not emit prose, interpretive labels, source text, or unsupported distinctions. IDs do not prove relevance or completeness. Use PDF IDs only for verified nonempty textPages records. Pages marked no-extracted-text have no selectable IDs; other verified pages remain usable. Missing text is not proof that facts are absent. Web snippets and wholly unavailable PDF extraction have no selectable text; never invent IDs or substitute prose. If no selectable blocks support the request, emit only {"end":true}. No further composer follows.`
              : ""),
          prompt,
          beforeStep: async () => {
            await pdf.assertCurrent();
            if (exposureValidator) await exposureValidator.validate([...exposedOriginals.values()]);
            else
              await Promise.all(
                [...exposedOriginals.values()].map(source =>
                  assertPublicSourceCurrent(artistId, source),
                ),
              );
          },
          tools: {
            ...pdf.tools,
            searchSources: createSearchSourcesTool(
              originals,
              name,
              validateExposure,
              exposureValidator ? validateExposures : undefined,
            ),
            readSource,
            webSearch: createWebSearchTool(cite),
          },
          stopWhen: isStepCount(6),
          abortSignal: signal,
          writer: outputWriter,
        }).catch(error => {
          // The merged stream has already sent the client its error part.
          console.error("[chat] stream failed", error);
        });
      },
    });
    return createUIMessageStreamResponse({ stream, headers });
  } catch (error) {
    const quota = questionQuotaResponse(error);
    if (quota) return quota;
    console.error("[chat] failed", error);
    return fail("Chat is temporarily unavailable. Please try again.", 503);
  }
}
