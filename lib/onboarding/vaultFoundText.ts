import { pluralize } from "@/lib/text/pluralize";

/**
 * The vault-step line for sources found, naming what to add.
 *
 * @param count - How many sources are pending.
 * @returns The chat line.
 */
export function vaultFoundText(count: number): string {
  return `We found ${count} ${pluralize(count, "source", "sources")} about you. Keep what's accurate, and add anything we missed — press, interviews, features, your own site. These feed your About and the answers your page gives fans.`;
}
