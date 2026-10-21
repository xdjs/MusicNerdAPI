import { z } from "zod";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
const schema = z.object({ requestId: z.uuid() }).strict();

/** Accepts only a UUID request receipt; callers cannot supply an account or job scope. */
export async function validateEditorSourceSearchInput(request: Request) {
  const body =
    request.method === "POST"
      ? await request.json().catch(() => null)
      : Object.fromEntries(new URL(request.url).searchParams);
  const input = schema.safeParse(body);
  return input.success
    ? input.data
    : NextResponse.json(
        { status: "error", error: "A valid requestId is required" },
        { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
      );
}
