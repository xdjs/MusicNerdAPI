import { z } from "zod";

/** `parseInt(value) || fallback`, as MusicNerdWeb's route read these. */
const intOr = (fallback: number) =>
  z.preprocess(value => parseInt(String(value ?? ""), 10) || fallback, z.number().int());

const schema = z.object({
  sections: z.string().nullable(),
  auditPage: intOr(1),
  auditLimit: intOr(50),
});

/**
 * Reads the query of GET /api/admin/agent-work. Nothing is rejected, as in
 * MusicNerdWeb: `sections` other than `details` means the summary, and a page
 * or limit that isn't a number falls back to 1 and 50. The audit log clamps
 * the range.
 *
 * @param request - The request.
 * @returns Whether details were asked for, and the audit page and limit.
 */
export function validateAgentWorkQuery(request: Request): {
  details: boolean;
  auditPage: number;
  auditLimit: number;
} {
  const url = new URL(request.url);
  const query = schema.parse({
    sections: url.searchParams.get("sections"),
    auditPage: url.searchParams.get("auditPage"),
    auditLimit: url.searchParams.get("auditLimit"),
  });
  return {
    details: query.sections === "details",
    auditPage: query.auditPage,
    auditLimit: query.auditLimit,
  };
}
