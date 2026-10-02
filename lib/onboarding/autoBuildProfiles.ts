import { discoverArtistProfilesStream } from "@/lib/discovery/discoverArtistProfilesStream";
import type { DiscoveredProfile } from "@/lib/discovery/types";
import { applyProfileLinkDecisions } from "@/lib/onboarding/applyProfileLinkDecisions";
import { confirmOnboardingStep } from "@/lib/onboarding/confirmOnboardingStep";
import { PROFILE_SEARCH_GROUP } from "@/lib/onboarding/const";
import type { AutoBuildProfilesResult, TurnEvent } from "@/lib/onboarding/types";
import { queueSocialIngest } from "@/lib/research/queueSocialIngest";
import { pluralize } from "@/lib/text/pluralize";

/**
 * Auto-build stage 1: find the artist's missing profiles and write them.
 * Nobody has looked at these, so the identity guards run. One write per
 * platform (the first found; tiers run in authority order); a second account
 * becomes a question for the artist. Then the Instagram scrape is queued, not
 * run: it takes minutes and this turn has seconds.
 *
 * @param artistId - The artist.
 * @returns The stage's events; its return value tells the source stage what was guessed.
 */
export async function* autoBuildProfiles(
  artistId: string,
): AsyncGenerator<TurnEvent, AutoBuildProfilesResult> {
  yield {
    kind: "progress",
    label: "Finding your profiles",
    done: false,
    group: PROFILE_SEARCH_GROUP,
  };
  const discovered: DiscoveredProfile[] = [];
  /** "We found nothing there" and "they wouldn't tell us" are different sentences. */
  const unreachable: string[] = [];
  try {
    for await (const event of discoverArtistProfilesStream(artistId)) {
      if (event.kind === "found") {
        discovered.push(event.profile);
        yield { kind: "candidate", profile: event.profile };
      }
      if (event.kind === "unreachable") unreachable.push(event.displayName);
    }
  } catch (e) {
    console.error("[onboarding] auto-build discovery failed:", e);
  }

  let provisionalSiteNames: string[] = [];
  const discoveredBySiteName = new Map<string, DiscoveredProfile>();
  if (discovered.length > 0) {
    const primaries: DiscoveredProfile[] = [];
    const byPlatform = new Map<string, DiscoveredProfile[]>();
    for (const p of discovered) {
      const group = byPlatform.get(p.siteName);
      if (group) group.push(p);
      else {
        byPlatform.set(p.siteName, [p]);
        primaries.push(p);
      }
    }
    const outcome = await applyProfileLinkDecisions(
      artistId,
      primaries.map(p => ({ url: p.profileUrl })),
      [],
      { verifyIdentity: true },
    );
    // What was WRITTEN, not proposed: the guards refuse some.
    const wrote = new Set(outcome.written);
    provisionalSiteNames = [
      ...new Set(
        primaries.filter(p => p.provisional && wrote.has(p.siteName)).map(p => p.siteName),
      ),
    ];
    for (const p of primaries) if (wrote.has(p.siteName)) discoveredBySiteName.set(p.siteName, p);
    yield { kind: "linked", profiles: [...discoveredBySiteName.values()] };
    // Only where the write landed: don't offer a choice we already declined to make.
    for (const [platform, options] of byPlatform) {
      if (options.length < 2 || !wrote.has(platform)) continue;
      yield { kind: "choices", platform, chosen: options[0].value, options };
    }
  }

  if (unreachable.length > 0) yield { kind: "unreachable", platforms: unreachable };
  await queueSocialIngest(artistId, {});
  yield {
    kind: "progress",
    label:
      discovered.length > 0
        ? `Found ${discovered.length} ${pluralize(discovered.length, "profile", "profiles")}`
        : "Checked for your profiles",
    done: true,
    group: PROFILE_SEARCH_GROUP,
  };
  await confirmOnboardingStep(artistId, "profiles");
  return { provisionalSiteNames, discoveredBySiteName };
}
