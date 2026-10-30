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
import { createChatConflictFallback } from "@/lib/chat/createChatConflictFallback";
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
    const originals = await loadPublicResearchOriginals(artistId);
    const name = artist.name ?? "This artist";
    const prompt = await convertToModelMessages(body.messages);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cite = createChatCitations(writer);
        const conflict = createChatConflictFallback(originals, cite, writer);
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
          beforeStep: pdf.assertCurrent,
          tools: {
            ...pdf.tools,
            searchSources: createSearchSourcesTool(originals, name),
            readSource: conflict.readSource,
            showSourceDifferences: conflict.showSourceDifferences,
            webSearch: createWebSearchTool(cite),
          },
          stopWhen: [isStepCount(6), conflict.stop],
          abortSignal: request.signal,
          writer: conflict.writer,
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
