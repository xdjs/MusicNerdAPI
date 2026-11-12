import type { LinkSuggestion } from "@/lib/artistLinkReview/types";
import { discoveryEvidenceSchema } from "@/lib/discovery/evidence";

/** Project only supported recorded observations; old or malformed evidence is unavailable. */
export function getLinkSuggestionEvidence(
  raw: unknown,
): NonNullable<LinkSuggestion["evidence"]> | null {
  const parsed = discoveryEvidenceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { method, artistName, sourceUrl, observedTitle } = parsed.data;
  return {
    method,
    artistName,
    sourceUrl,
    observedTitle,
    summary:
      method === "name_handle_probe"
        ? `A handle based on “${artistName}” led to this profile, and the recorded page title matched that name.`
        : `A platform search returned this profile with a handle matching “${artistName}”.`,
  };
}
