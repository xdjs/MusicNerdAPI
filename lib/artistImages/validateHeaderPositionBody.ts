import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const schema = z
  .object({
    artistId: z.uuid(),
    imageUrl: z
      .string()
      .max(4096)
      .refine(value => {
        if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    y: z.number().int().min(0).max(100),
  })
  .strict();

/** A validated header position. */
export type HeaderPositionBody = z.infer<typeof schema>;

/**
 * The body of PATCH /api/artist/header-position: the image the position is
 * for (a site-relative path or an `https` URL without credentials) and how far
 * down it is framed.
 *
 * @param request - The request.
 * @returns The parsed body, or a 400 `{ status: "error", error: "Invalid photo position" }`.
 */
export async function validateHeaderPositionBody(
  request: Request,
): Promise<HeaderPositionBody | NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { status: "error", error: "Invalid photo position" },
      { status: 400, headers: getCorsHeaders() },
    );
  return parsed.data;
}
