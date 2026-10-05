import { confirmOnboardingStep } from "@/lib/onboarding/confirmOnboardingStep";
import { NARRATION, TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { enrichVaultSource } from "@/lib/onboarding/enrichVaultSource";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";
import { getVaultSourceByIdAndArtist } from "@/lib/vault/getVaultSourceByIdAndArtist";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import { updateVaultSourceStatus } from "@/lib/vault/updateVaultSourceStatus";

/**
 * The artist's decisions on the vault card. Only their own sources are
 * touched; links they paste go straight to approved (they added them) and are
 * queued for durable original-text extraction. Then the interview starts.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with decisions and pasted URLs.
 * @returns The turn's events.
 */
export async function* handleVaultReviewTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "vault_review" }>,
): AsyncGenerator<TurnEvent> {
  const { artistId } = ctx;
  if (!(yield* guardTurnStep(ctx, "vault", TURN_MESSAGES.notYet))) return;
  for (const decision of turn.decisions ?? []) {
    if (!(await getVaultSourceByIdAndArtist(decision.sourceId, artistId))) continue;
    await updateVaultSourceStatus(decision.sourceId, decision.status);
  }
  for (const rawUrl of turn.addedUrls ?? []) {
    const url = normalizePublicUrl(rawUrl);
    if (!url || isUnsafeUrl(url)) continue;
    try {
      const source = await insertVaultSource({
        artistId,
        url,
        type: inferTypeFromUrl(url),
        status: "approved",
      });
      if (source?.id) await enrichVaultSource(source.id, url, { keepTitle: false });
    } catch (e) {
      console.error(`[onboarding] insertVaultSource failed for ${url}:`, e);
    }
  }
  await confirmOnboardingStep(artistId, "vault");
  yield { kind: "chat", text: NARRATION.vaultDone };
  yield* emitStep(artistId, "interview");
}
