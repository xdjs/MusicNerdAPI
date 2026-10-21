import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";

const bodySchema = z.object({
  url: z
    .string()
    .transform(url => canonicalizeLoreUrl(url))
    .refine(
      (url): url is string =>
        !!url && isIP(new URL(url).hostname) === 0 && !isUnsafeUrl(url) && url.length <= 2048,
    ),
});

/**
 * Validates a suggested Lore source: a public http(s) web page, canonicalized
 * (https:// for a bare domain, no fragment). IP addresses, private and local
 * hosts, and URLs over 2,048 characters are refused.
 *
 * @param body - The parsed JSON body, or null when it wasn't JSON.
 * @returns `{ url }`, the canonical URL, or a 400.
 */
export function validateLoreSuggestionBody(body: unknown): { url: string } | NextResponse {
  const parsed = bodySchema.safeParse(body);
  if (parsed.success) return { url: parsed.data.url };
  return NextResponse.json(
    { status: "error", error: "Enter a public website URL" },
    { status: 400, headers: getCorsHeaders() },
  );
}
