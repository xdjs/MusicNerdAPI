import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { questionRequestSchema } from "@/lib/questionResearch/questionRequestSchema";

/** Read the ask body the way Web did: bounded raw size, then JSON, then the strict request schema, each with its own 400 message. */
export async function validateAskArtistBody(
  request: Request,
): Promise<z.infer<typeof questionRequestSchema> | NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const raw = await request.text();
  if (raw.length > 18000)
    return NextResponse.json(
      { status: "error", error: "Question too long" },
      { status: 400, headers },
    );
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid question" },
      { status: 400, headers },
    );
  }
  const parsed = questionRequestSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid artist or question" },
      { status: 400, headers },
    );
  return parsed.data;
}
