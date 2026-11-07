import { getAllLinks } from "@/lib/artists/getAllLinks";
import { getArtistById } from "@/lib/artists/getArtistById";
import { yieldWhileRunning } from "@/lib/async/yieldWhileRunning";
import type { DiscoveredProfile } from "@/lib/discovery/types";
import { adoptedProfiles } from "@/lib/onboarding/adoptedProfiles";
import { confirmOnboardingStep } from "@/lib/onboarding/confirmOnboardingStep";
import { VAULT_DISCOVERY_BUDGET_MS, VAULT_SEARCH_GROUP } from "@/lib/onboarding/const";
import { secondAccountChoices } from "@/lib/onboarding/secondAccountChoices";
import { toSourceView } from "@/lib/onboarding/toSourceView";
import type { TurnEvent } from "@/lib/onboarding/types";
import { isCitableSource } from "@/lib/sources/isCitableSource";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";
import { searchAndPopulateVault } from "@/lib/vault/searchAndPopulateVault";
import { updateVaultSourceStatus } from "@/lib/vault/updateVaultSourceStatus";
import type { VaultSource } from "@/lib/vault/types";
import { pluralize } from "@/lib/text/pluralize";

/**
 * Auto-build stage 2: search the web for sources with a 45 s discovery deadline, streaming
 * each as it's saved. Then report the links the search adopted, ask about a
 * guessed account it replaced, and approve only unchanged readable research
 * inserted by this run. Existing contributions retain their moderation state.
 *
 * @param artistId - The artist.
 * @param provisionalSiteNames - Columns stage 1 filled with a guess.
 * @param discoveredBySiteName - The profile stage 1 wrote for each platform.
 * @returns The stage's events; its return value is how many sources are citable.
 */
export async function* autoBuildSources(
  artistId: string,
  provisionalSiteNames: string[],
  discoveredBySiteName: Map<string, DiscoveredProfile>,
): AsyncGenerator<TurnEvent, { citable: number }> {
  yield {
    kind: "progress",
    label: "Reading what's written about you",
    done: false,
    group: VAULT_SEARCH_GROUP,
  };
  const beforeSearch = (await getArtistById(artistId).catch(() => undefined)) as
    Record<string, unknown> | undefined;
  // Await settlement: a budget race would hide a late provider failure and confirm
  // the stage while discovery is still running. The search checks its own deadline.
  const saved = yield* yieldWhileRunning<TurnEvent, VaultSource[]>(emit =>
    searchAndPopulateVault(artistId, {
      deadline: Date.now() + VAULT_DISCOVERY_BUDGET_MS,
      requireComplete: true,
      provisionalSiteNames,
      onSaved: source => emit({ kind: "source", source: toSourceView(source) }),
    }),
  );
  const afterSearch = (await getArtistById(artistId).catch(() => undefined)) as
    Record<string, unknown> | undefined;
  const urlmap = await getAllLinks().catch(() => []);
  const adopted = adoptedProfiles(beforeSearch, afterSearch, urlmap);
  if (adopted.length > 0) yield { kind: "linked", profiles: adopted };
  if (provisionalSiteNames.length > 0) {
    try {
      yield* secondAccountChoices(provisionalSiteNames, discoveredBySiteName, afterSearch, urlmap);
    } catch (e) {
      // The better-evidenced handle is already written; the artist just isn't asked.
      console.error("[onboarding] could not offer the second-account choice:", e);
    }
  }

  for (const source of saved) {
    try {
      await updateVaultSourceStatus(source.id, "approved", source);
    } catch (e) {
      console.error("[onboarding] auto-approve failed:", source.id, e);
    }
  }
  // Everything on the page now, including what claim approval's own search saved.
  const onPage = await getVaultSourcesByStatus(artistId, "approved");
  const citable = onPage.filter(isCitableSource).length;
  yield { kind: "sources", sources: onPage.map(toSourceView) };
  yield {
    kind: "progress",
    label:
      saved.length > 0
        ? `Read ${saved.length} ${pluralize(saved.length, "source", "sources")}`
        : "Looked for sources about you",
    done: true,
    group: VAULT_SEARCH_GROUP,
  };
  await confirmOnboardingStep(artistId, "vault");
  return { citable };
}
