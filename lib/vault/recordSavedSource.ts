import type { SearchRun, VaultSource } from "@/lib/vault/types";

/**
 * Keeps a source the run just saved and tells the caller's listener. A
 * listener that throws is logged and ignored: reporting never costs a source.
 *
 * @param run - The search run.
 * @param source - The saved source.
 * @returns Nothing.
 */
export function recordSavedSource(run: SearchRun, source: VaultSource): void {
  run.saved.push(source);
  try {
    run.onSaved?.(source);
  } catch (e) {
    console.error("[vaultWebSearch] onSaved failed:", e);
  }
}
