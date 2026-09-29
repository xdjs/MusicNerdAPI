import { waitAtMost } from "@/lib/async/waitAtMost";
import { PROFILE_PREVIEW_BUDGET_MS } from "@/lib/onboarding/const";
import { fetchLinkPreview } from "@/lib/pages/fetchLinkPreview";

/**
 * Artist-photo previews for the profile cards, all in parallel, bounded at 5 s
 * overall. Never throws; a preview that failed or didn't arrive in time is
 * simply absent (callers treat a miss as null).
 *
 * @param entries - `[siteName, profileUrl]` pairs.
 * @returns Each site's preview image, for those that arrived.
 */
export async function gatherProfilePreviews(
  entries: [siteName: string, profileUrl: string][],
): Promise<Map<string, string | null>> {
  const settled = new Map<string, string | null>();
  if (entries.length === 0) return settled;
  const gathering = Promise.all(
    entries.map(async ([siteName, profileUrl]) => {
      const preview = await fetchLinkPreview(profileUrl);
      settled.set(siteName, preview.imageUrl);
    }),
  );
  await waitAtMost(gathering, PROFILE_PREVIEW_BUDGET_MS);
  return settled;
}
