import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { PORTED_JOB_KINDS } from "@/lib/research/const";

const bodySchema = z.object({
  artistId: z.uuid().optional(),
  kinds: z
    .array(z.enum(PORTED_JOB_KINDS as [string, ...string[]]))
    .min(1)
    .optional(),
});

/**
 * Reads POST /api/research/advance's body. An empty or unreadable body means
 * "any artist", as MusicNerdWeb's route treated it.
 *
 * @param request - The incoming request.
 * `kinds` narrows the claim, e.g. Update Latest's pump asks only for
 * `latest_refresh` so it never waits behind a long caption job.
 *
 * @returns The parsed body, or a 400 response when `artistId` is not a UUID or `kinds` names a kind this API doesn't run.
 */
export async function validateAdvanceResearchBody(
  request: Request,
): Promise<z.infer<typeof bodySchema> | NextResponse> {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  return NextResponse.json(
    {
      status: "error",
      error:
        parsed.error.issues[0]?.path[0] === "kinds"
          ? "kinds must be job kinds this API runs"
          : "artistId must be a UUID",
    },
    { status: 400, headers: getCorsHeaders() },
  );
}
