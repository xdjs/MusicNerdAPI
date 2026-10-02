import { discoverArtistProfilesStream } from "@/lib/discovery/discoverArtistProfilesStream";
import type { DiscoveredProfile } from "@/lib/discovery/types";
import { buildProfilesPayload } from "@/lib/onboarding/buildProfilesPayload";
import { NARRATION, PROFILE_SEARCH_GROUP } from "@/lib/onboarding/const";
import { profilesCandidatesFoundText } from "@/lib/onboarding/profilesCandidatesFoundText";
import type { TurnEvent } from "@/lib/onboarding/types";
import { pluralize } from "@/lib/text/pluralize";

/**
 * The profiles card. With `discoverProfiles` it first searches for profiles
 * the artist is missing, streaming each one as it clears validation, under one
 * collapsing progress line counting distinct platforms. That line flips to
 * done once, after the stream ends, never inferred from "nothing in flight"
 * (true between tiers too).
 *
 * @param artistId - The artist.
 * @param discoverProfiles - Run discovery (a fresh entry, or "look for more"), not a re-show.
 * @returns The step's events.
 */
export async function* emitProfilesStep(
  artistId: string,
  discoverProfiles: boolean,
): AsyncGenerator<TurnEvent> {
  yield { kind: "progress", label: "Gathering your profiles", done: false };
  const payload = await buildProfilesPayload(artistId);
  yield { kind: "progress", label: "Gathering your profiles", done: true };

  const candidates: DiscoveredProfile[] = [];
  /** Platforms that turned the probe away: the card says "couldn't check", not missing. */
  const unreachable: string[] = [];
  if (discoverProfiles) {
    const seenPlatforms = new Set<string>();
    try {
      for await (const event of discoverArtistProfilesStream(artistId)) {
        if (event.kind === "searching" && !seenPlatforms.has(event.platform)) {
          seenPlatforms.add(event.platform);
          yield {
            kind: "progress",
            label: `Searching ${seenPlatforms.size} ${pluralize(seenPlatforms.size, "platform", "platforms")}…`,
            done: false,
            group: PROFILE_SEARCH_GROUP,
          };
        } else if (event.kind === "found") {
          candidates.push(event.profile);
          yield { kind: "candidate", profile: event.profile };
        } else if (event.kind === "unreachable") {
          unreachable.push(event.platform);
        }
      }
    } catch (e) {
      console.error("[onboarding] profile discovery stream failed:", e);
    }
    if (seenPlatforms.size > 0) {
      yield {
        kind: "progress",
        label: `Searched ${seenPlatforms.size} ${pluralize(seenPlatforms.size, "platform", "platforms")}`,
        done: true,
        group: PROFILE_SEARCH_GROUP,
      };
    }
  }

  const base = payload.links.length > 0 ? NARRATION.profiles : NARRATION.profilesEmpty;
  const narration =
    candidates.length > 0 ? `${base} ${profilesCandidatesFoundText(candidates.length)}` : base;
  yield { kind: "chat", text: narration };
  yield { kind: "step", step: "profiles", payload: { ...payload, candidates, unreachable } };
}
