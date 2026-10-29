import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCanvasStoredOriginals } from "@/lib/canvas/loadCanvasStoredOriginals";
import { loadCanvasPublicPdfOriginals } from "@/lib/canvas/loadCanvasPublicPdfOriginals";
import { settleCanvasPreview } from "@/lib/canvas/settleCanvasPreview";
import { reserveCanvasPreview } from "@/lib/canvas/reserveCanvasPreview";
import { canvasSeeds } from "@/lib/canvas/const";
import { createCanvasContext } from "@/lib/canvas/createCanvasContext";
import { MODEL_CHAT } from "@/lib/ai/const";
import { streamText } from "@/lib/ai/streamText";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { createChatCitations } from "@/lib/chat/createChatCitations";
import { createReadSourceTool } from "@/lib/chat/createReadSourceTool";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { createWebSearchTool } from "@/lib/chat/createWebSearchTool";
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
    if (
      body.canvas &&
      (process.env.VERCEL_ENV !== "preview" ||
        process.env.MUSICNERD_CANVAS_PREVIEW_ENABLED !== "1" ||
        MODEL_CHAT !== "anthropic/claude-sonnet-5.5" ||
        [process.env.SUPABASE_URL, process.env.SUPABASE_DB_CONNECTION].some(value =>
          value?.includes("cbabvmebugudeuylronz"),
        ))
    )
      return fail("Live canvas planning is disabled for this preview", 503);
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
    let canvasReservation: string | undefined;
    if (body.canvas) {
      try {
        canvasReservation = await reserveCanvasPreview(artistId);
      } catch {
        return fail(
          "The live preview budget is unavailable or exhausted. Your existing canvas and source links remain usable.",
          429,
        );
      }
    }
    const storedOriginals = body.canvas
      ? await loadCanvasStoredOriginals(artistId)
      : await loadPublicResearchOriginals(artistId);
    const publicPdfs = body.canvas
      ? await loadCanvasPublicPdfOriginals(artistId, request.signal)
      : { sources: [], limitations: [] };
    const originals = [...storedOriginals, ...publicPdfs.sources];
    const name = artist.name ?? "This artist";
    const prompt = await convertToModelMessages(body.messages);
    const stream = createUIMessageStream({
      ...(body.canvas ? { generateId: () => body.canvas!.turnId } : {}),
      execute: async ({ writer }) => {
        const cite = createChatCitations(writer);
        const canvas = body.canvas
          ? createCanvasContext(
              body.canvas,
              originals,
              cite,
              canvasSeeds[artistId] ?? [],
              publicPdfs.limitations,
              body.messages
                .at(-1)
                ?.parts.map(p => p.text)
                .join("\n") ?? "",
              name,
            )
          : undefined;
        await streamText({
          model: MODEL_CHAT,
          anthropicEffort: "low",
          instructions:
            buildArtistChatInstructions(name) +
            (canvas?.instructions ?? "") +
            (canvas
              ? `\nCURRENT TURN: ${JSON.stringify(
                  body.messages
                    .at(-1)
                    ?.parts.map(p => p.text)
                    .join("\n"),
                )}. This latest request supersedes earlier requests about what to keep or add. Previous conversation is context, not a requirement to retain old content. Apply explicit removal requests to the nextSpec. Do not substitute rearrangement for removal. Explain the actual change you make.`
              : ""),
          prompt,
          tools: {
            searchSources: canvas?.searchSources ?? createSearchSourcesTool(originals, name),
            readSource: canvas?.readSource ?? createReadSourceTool(originals, cite),
            ...(canvas ? { composeCanvas: canvas.composeCanvas } : {}),
            ...(!canvas ? { webSearch: createWebSearchTool(cite) } : {}),
          },
          stopWhen: isStepCount(canvas ? 4 : 6),
          ...(canvas
            ? {
                maxRetries: 0,
                maxOutputTokens: 2048,
                prepareStep: ({
                  messages,
                  instructions,
                }: {
                  messages: unknown;
                  instructions: unknown;
                }) => {
                  // UTF-8 bytes conservatively upper-bound text tokens; leave 10k tokens for tool schemas/framing.
                  if (Buffer.byteLength(JSON.stringify({ messages, instructions }), "utf8") > 40000)
                    throw new Error("Canvas context limit reached");
                  return {};
                },
                onUsage: async (usage: { inputTokens?: number; outputTokens?: number }) => {
                  console.info(
                    "[canvas-usage]",
                    JSON.stringify({
                      turnId: body.canvas!.turnId,
                      model: MODEL_CHAT,
                      inputTokens: usage.inputTokens,
                      outputTokens: usage.outputTokens,
                      conservativeUsd:
                        usage.inputTokens !== undefined && usage.outputTokens !== undefined
                          ? usage.inputTokens * 0.00000275 + usage.outputTokens * 0.000011
                          : null,
                    }),
                  );
                  if (canvasReservation && !request.signal.aborted) {
                    try {
                      const chargedMicros = await settleCanvasPreview(canvasReservation, usage);
                      if (chargedMicros !== null)
                        console.info(
                          "[canvas-budget]",
                          JSON.stringify({
                            turnId: body.canvas!.turnId,
                            settledUsd: chargedMicros / 1_000_000,
                          }),
                        );
                    } catch {
                      console.warn(
                        "[canvas-budget] Settlement unavailable; full reservation retained",
                      );
                    }
                  }
                },
              }
            : {}),
          abortSignal: request.signal,
          writer,
        })
          .then(() => {
            const update = canvas?.getUpdate();
            if (update && !request.signal.aborted)
              writer.write({ type: "data-canvas", data: update });
          })
          .catch(error => {
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
