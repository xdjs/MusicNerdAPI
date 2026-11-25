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
import { createChatCitations } from "@/lib/chat/createChatCitations";
import { createChatDocuments } from "@/lib/chat/createChatDocuments";
import { createListDocumentsTool } from "@/lib/chat/createListDocumentsTool";
import { createReadUnitsTool } from "@/lib/chat/createReadUnitsTool";
import { getLatestUserText } from "@/lib/chat/getLatestUserText";
import { createSearchPassagesTool } from "@/lib/chat/createSearchPassagesTool";
import { getChatEffort } from "@/lib/chat/getChatEffort";
import { keepCurrentCitedTurns } from "@/lib/chat/keepCurrentCitedTurns";
import { seedCitationsFromPrior } from "@/lib/chat/seedCitationsFromPrior";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { createWebSearchTool } from "@/lib/chat/createWebSearchTool";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
import { loadPublicLatestResearchOriginals } from "@/lib/questionResearch/loadPublicLatestResearchOriginals";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { questionQuotaResponse } from "@/lib/questionResearch/questionQuotaResponse";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";
import { assertDocumentsCurrent } from "@/lib/units/assertDocumentsCurrent";
import { READ_UNITS_TOKEN_BUDGET } from "@/lib/units/types";

/**
 * One chat turn about an artist: spends one question from the hourly
 * allowance, then streams the answer as an AI SDK UI message stream. The
 * model searches and reads the artist's documents page by page (`searchPassages`, `readUnits`,
 * `listDocuments`), keeps the numbers earlier answers gave their documents, and cites pages as
 * `[n, p.N]`, matching the `source-url` parts. `searchSources` and `readSource` serve only the
 * latest releases and published answers; `webSearch` covers what the documents can't answer.
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
    const name = artist.name ?? "This artist";
    // An earlier answer is replayed only while every document it numbered is current.
    const { messages, prior, highestCitedNumber } = await keepCurrentCitedTurns(
      body.messages,
      artistId,
    );
    // searchSources/readSource serve only the latest releases and published answers.
    const originals = await loadPublicLatestResearchOriginals(artistId);
    const prompt = await convertToModelMessages(messages);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // A number an earlier answer used is never reused for another source.
        const cite = createChatCitations(writer, seedCitationsFromPrior(prior), highestCitedNumber);
        const documents = createChatDocuments(cite, prior);
        const budget = { remainingTokens: READ_UNITS_TOKEN_BUDGET };
        await streamText({
          model: MODEL_CHAT,
          anthropicEffort: getChatEffort(),
          instructions: buildArtistChatInstructions(name),
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
              // The real name only: the "This artist" fallback is not a name to match in passages.
              names: artist.name ? [artist.name] : [],
              question: getLatestUserText(body.messages),
              // An earlier user message means the latest one may lean on context the query spells out.
              followUp: body.messages.filter(message => message.role === "user").length > 1,
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
  } catch (error) {
    const quota = questionQuotaResponse(error);
    if (quota) return quota;
    console.error("[chat] failed", error);
    return fail("Chat is temporarily unavailable. Please try again.", 503);
  }
}
