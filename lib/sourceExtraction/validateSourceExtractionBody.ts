import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Require a bounded, explicit set of stored source IDs; caller identity comes from auth. */
export async function validateSourceExtractionBody(request: Request) {
  const schema = z
    .object({
      sourceIds: z
        .array(z.string().uuid())
        .min(1)
        .max(20)
        .refine(ids => new Set(ids).size === ids.length),
    })
    .strict();
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          throw new Error("Body too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    return NextResponse.json(
      { status: "error", error: "Select 1–20 distinct source IDs" },
      { status: 400, headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
    );
  }
}
