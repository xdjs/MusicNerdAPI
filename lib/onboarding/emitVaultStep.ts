import { waitAtMost } from "@/lib/async/waitAtMost";
import { NARRATION, VAULT_DISCOVERY_BUDGET_MS } from "@/lib/onboarding/const";
import type { TurnEvent } from "@/lib/onboarding/types";
import { vaultFoundText } from "@/lib/onboarding/vaultFoundText";
import { isCitableSource } from "@/lib/sources/isCitableSource";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";
import { searchAndPopulateVault } from "@/lib/vault/searchAndPopulateVault";

/**
 * The vault card: the pending sources to review. The web is searched (bounded
 * at 45 s) when nothing is pending and nothing web-found is approved, or when
 * forced: an upload or the artist's own site is a gift from them, not
 * evidence the web was searched. Each source says whether we read it.
 *
 * @param artistId - The artist.
 * @param forceVaultDiscovery - Search even with sources pending (the confirm turn just routed some in).
 * @returns The step's events.
 */
export async function* emitVaultStep(
  artistId: string,
  forceVaultDiscovery: boolean,
): AsyncGenerator<TurnEvent> {
  let pending = await getVaultSourcesByStatus(artistId, "pending");
  if (forceVaultDiscovery || pending.length === 0) {
    const approved = (await getVaultSourcesByStatus(artistId, "approved")).filter(s => !s.filePath);
    if (forceVaultDiscovery || approved.length === 0) {
      yield { kind: "progress", label: "Searching the web for sources about you", done: false };
      try {
        await waitAtMost(
          searchAndPopulateVault(artistId, { deadline: Date.now() + VAULT_DISCOVERY_BUDGET_MS }),
          VAULT_DISCOVERY_BUDGET_MS,
        );
        pending = await getVaultSourcesByStatus(artistId, "pending");
      } catch (e) {
        console.error("[onboarding] vault discovery failed:", e);
      }
      yield { kind: "progress", label: "Searching the web for sources about you", done: true };
    }
  }
  yield {
    kind: "chat",
    text: pending.length > 0 ? vaultFoundText(pending.length) : NARRATION.vaultEmpty,
  };
  yield {
    kind: "step",
    step: "vault",
    payload: {
      sources: pending.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        snippet: s.snippet,
        ogImage: s.ogImage ?? null,
        verified: isCitableSource(s),
      })),
    },
  };
}
