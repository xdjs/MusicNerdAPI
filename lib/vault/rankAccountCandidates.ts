import type { AccountCandidate } from "@/lib/vault/types";

/**
 * Orders account candidates for checking. A handle that IS the artist's name
 * goes first; otherwise the order is kept. Pharaoh Sistare's search returns
 * both pharaohsistare and pherosistar, and whichever was checked first won.
 *
 * @param candidates - The account candidates.
 * @param artistName - The artist's name.
 * @returns A sorted copy.
 */
export function rankAccountCandidates(
  candidates: AccountCandidate[],
  artistName: string,
): AccountCandidate[] {
  const foldedName = artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [...candidates].sort(
    (a, b) =>
      (a.id.toLowerCase().replace(/[^a-z0-9]/g, "") === foldedName ? 0 : 1) -
      (b.id.toLowerCase().replace(/[^a-z0-9]/g, "") === foldedName ? 0 : 1),
  );
}
