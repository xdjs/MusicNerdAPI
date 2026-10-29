import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

import { canvasRequestSchema } from "@/lib/canvas/const";

const MAX_MESSAGES = 12;
const question = z.string().trim().min(1).max(500);

const textPart = z.object({ type: z.literal("text"), text: z.string() });
const chatBodySchema = z
  .object({
    canvas: canvasRequestSchema.optional(),
    messages: z
      .array(
        z.object({
          id: z.string(),
          role: z.enum(["user", "assistant"]),
          // Tool, source and step parts are the client's record of earlier turns; only their text is context.
          parts: z.array(z.looseObject({ type: z.string() })).transform(parts =>
            parts.flatMap(part => {
              const text = textPart.safeParse(part);
              return text.success ? [{ type: "text" as const, text: text.data.text }] : [];
            }),
          ),
        }),
      )
      .min(1)
      .transform(messages => messages.slice(-MAX_MESSAGES)),
  })
  .strict()
  .refine(({ messages }) => {
    const last = messages.at(-1);
    if (!last) return false;
    const text = last.parts.map(part => part.text).join("\n");
    return last.role === "user" && question.safeParse(text).success;
  });

export type ArtistChatBody = z.infer<typeof chatBodySchema>;

/**
 * Reads a chat body: `{ messages: UIMessage[] }` whose last message is the
 * visitor's question, at most 500 characters. Keeps the last 12
 * messages and only their text parts.
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
