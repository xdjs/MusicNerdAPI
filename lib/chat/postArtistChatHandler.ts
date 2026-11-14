import { assertPublicSourceCurrent } from "@/lib/sourcePublication/assertPublicSourceCurrent";
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
import { gateStepText } from "@/lib/chat/gateStepText";
import { keepCurrentPdfTurns } from "@/lib/chat/keepCurrentPdfTurns";
import { createChatCitations } from "@/lib/chat/createChatCitations";
import { createChatDocuments } from "@/lib/chat/createChatDocuments";
import { createListDocumentsTool } from "@/lib/chat/createListDocumentsTool";
import { createReadUnitsTool } from "@/lib/chat/createReadUnitsTool";
import { createSearchPassagesTool } from "@/lib/chat/createSearchPassagesTool";
import { getChatRetrievalMode } from "@/lib/chat/getChatRetrievalMode";
import { keepCurrentCitedTurns } from "@/lib/chat/keepCurrentCitedTurns";
import { seedCitationsFromPrior } from "@/lib/chat/seedCitationsFromPrior";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { createWebSearchTool } from "@/lib/chat/createWebSearchTool";
import { createChatPdfTools } from "@/lib/chatPdf/createChatPdfTools";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
import { loadPublicLatestResearchOriginals } from "@/lib/questionResearch/loadPublicLatestResearchOriginals";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { questionQuotaResponse } from "@/lib/questionResearch/questionQuotaResponse";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";
import { assertDocumentsCurrent } from "@/lib/units/assertDocumentsCurrent";
import { READ_UNITS_TOKEN_BUDGET } from "@/lib/units/types";

/**
 * One chat turn about an artist: spends one question from the hourly
 * allowance, then streams the answer as an AI SDK UI message stream. The
 * model searches and reads the artist's stored public sources (and the web
 * when they can't answer) and cites them as `[n]`, matching the
 * `source-url` parts.
 *
 * With `CHAT_RETRIEVAL=units` (`getChatRetrievalMode`) the model instead searches and reads the
 * artist's documents page by page (`searchPassages`, `readUnits`, `listDocuments`), keeps the
 * numbers earlier answers gave their documents, and cites pages as `[n, p.N]`; `searchSources` and
 * `readSource` serve only the latest releases and published answers, and there are no PDF tools.
 *
 * @param request - `{ messages: UIMessage[] }`, with an optional Privy bearer token.
 * @param artistId - The artist's id from the path.
 * @returns The stream, or a 400, 404, 429 or 503 error.
 */
export async function postArtistChatHandler(request: Request, artistId: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  try {
    const body = await validateArtistChatBody(request);
    if (body instanceof NextResponse) return body;
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
    if (getChatRetrievalMode() === "units") {
      const name = artist.name ?? "This artist";
      // An earlier answer is replayed only while every document it numbered (and any PDF it read) is current.
      const { messages, prior, highestCitedNumber } = await keepCurrentCitedTurns(
        body.messages,
        artistId,
      );
      // The whole-corpus load is gone; searchSources/readSource keep only the "latest" path.
      const originals = await loadPublicLatestResearchOriginals(artistId);
      const prompt = await convertToModelMessages(messages);
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // A number an earlier answer used is never reused for another source.
          const cite = createChatCitations(
            writer,
            seedCitationsFromPrior(prior),
            highestCitedNumber,
          );
          const documents = createChatDocuments(cite, prior);
          const budget = { remainingTokens: READ_UNITS_TOKEN_BUDGET };
          await streamText({
            model: MODEL_CHAT,
            anthropicEffort: "low",
            instructions: buildArtistChatInstructions(name, new Date(), "units"),
            prompt,
            maxOutputTokens: 1500,
            // One query per step: every document numbered so far is still public at its revision.
            beforeStep: () =>
              assertDocumentsCurrent(
                artistId,
                documents.all().map(document => document.ref),
              ),
            tools: {
              searchPassages: createSearchPassagesTool(artistId, documents, {
                names: [name],
                signal: request.signal,
                budget,
              }),
              readUnits: createReadUnitsTool(artistId, documents, budget),
              listDocuments: createListDocumentsTool(artistId, documents),
              searchSources: createSearchSourcesTool(originals, name),
              readSource: createReadSourceTool(originals, cite),
              webSearch: createWebSearchTool(cite),
            },
            stopWhen: isStepCount(6),
            abortSignal: request.signal,
            // Planning narration before a tool call never reaches the fan.
            writer: {
              write: part => writer.write(part),
              merge: stream => writer.merge(stream.pipeThrough(gateStepText())),
              onError: writer.onError,
            },
          }).catch(error => {
            // The merged stream has already sent the client its error part.
            console.error("[chat] stream failed", error);
          });
        },
      });
      return createUIMessageStreamResponse({ stream, headers });
    }
    const originals = await loadPublicResearchOriginals(artistId);
    const name = artist.name ?? "This artist";
    // An earlier answer that read a PDF is replayed only while that document is unchanged.
    const prompt = await convertToModelMessages(await keepCurrentPdfTurns(body.messages, artistId));
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cite = createChatCitations(writer);
        const exposedOriginals = new Map<string, ResearchOriginal>();
        const validateExposure = async (source: ResearchOriginal) => {
          await assertPublicSourceCurrent(artistId, source);
          exposedOriginals.set(source.sourceId, source);
        };
        const pdf = createChatPdfTools(
          artistId,
          cite,
          request.signal,
          body.messages
            .at(-1)!
            .parts.map(part => part.text)
            .join("\n"),
        );
        await streamText({
          model: MODEL_CHAT,
          anthropicEffort: "low",
          instructions: buildArtistChatInstructions(name),
          prompt,
          beforeStep: async () => {
            await pdf.assertCurrent();
            await Promise.all(
              [...exposedOriginals.values()].map(source =>
                assertPublicSourceCurrent(artistId, source),
              ),
            );
          },
          tools: {
            ...pdf.tools,
            searchSources: createSearchSourcesTool(originals, name, validateExposure),
            readSource: createReadSourceTool(originals, cite, validateExposure),
            webSearch: createWebSearchTool(cite),
          },
          stopWhen: isStepCount(6),
          abortSignal: request.signal,
          // Planning narration before a tool call never reaches the fan.
          writer: {
            write: part => writer.write(part),
            merge: stream => writer.merge(stream.pipeThrough(gateStepText())),
            onError: writer.onError,
          },
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
