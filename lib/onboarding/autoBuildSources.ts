import { getAllLinks } from "@/lib/artists/getAllLinks";
import { getArtistById } from "@/lib/artists/getArtistById";
import { waitAtMost } from "@/lib/async/waitAtMost";
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
import { pluralize } from "@/lib/text/pluralize";

/**
 * Auto-build stage 2: search the web for sources, bounded at 45 s, streaming
 * each as it's saved. Then report the links the search adopted, ask about a
 * guessed account it replaced, and approve everything pending. Approval is safe:
 * only machine-verified text makes a source citable, so a namesake stays an
 * uncitable lead the artist can remove.
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
  try {
    // A source saved after the budget is dropped: nothing is listening any more.
    yield* yieldWhileRunning<TurnEvent, unknown>(emit =>
      waitAtMost(
        searchAndPopulateVault(artistId, {
          deadline: Date.now() + VAULT_DISCOVERY_BUDGET_MS,
          provisionalSiteNames,
          onSaved: source => emit({ kind: "source", source: toSourceView(source) }),
        }),
        VAULT_DISCOVERY_BUDGET_MS,
      ),
    );
  } catch (e) {
    console.error("[onboarding] auto-build source discovery failed:", e);
  }
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

  const pending = await getVaultSourcesByStatus(artistId, "pending");
  for (const source of pending) {
    try {
      await updateVaultSourceStatus(source.id, "approved");
    } catch (e) {
      console.error("[onboarding] auto-approve failed:", source.id, e);
    }
  }
  const citable = pending.filter(isCitableSource).length;
  // Everything on the page now, including what claim approval's own search saved.
  const onPage = await getVaultSourcesByStatus(artistId, "approved");
  yield { kind: "sources", sources: onPage.map(toSourceView) };
  yield {
    kind: "progress",
    label:
      pending.length > 0
        ? `Read ${pending.length} ${pluralize(pending.length, "source", "sources")}`
        : "Looked for sources about you",
    done: true,
    group: VAULT_SEARCH_GROUP,
  };
  await confirmOnboardingStep(artistId, "vault");
  return { citable };
}
