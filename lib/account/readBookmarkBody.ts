import { NextResponse } from "next/server";
import type { z } from "zod";
import { bookmarkJson } from "@/lib/account/bookmarkJson";

/**
 * Reads a bookmark write's JSON body against its strict schema.
 *
 * @param request - The request.
 * @param schema - The body's schema.
 * @returns The parsed body, or a 400 response (`Invalid JSON body` or `Invalid bookmark request`).
 */
export async function readBookmarkBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bookmarkJson({ status: "error", error: "Invalid JSON body" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return bookmarkJson({ status: "error", error: "Invalid bookmark request" }, 400);
  return parsed.data as z.infer<T>;
}
