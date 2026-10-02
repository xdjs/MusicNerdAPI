import { artistOperations } from "@/lib/ownership/artistOperations";
import type { ArtistOperation } from "@/lib/ownership/types";

/**
 * The running artist operation, whichever artist it's for. For a write keyed
 * by something other than the artist (a vault source id) that must still take
 * the operation's claim check.
 *
 * @returns The operation, or undefined outside one.
 */
export function getActiveArtistOperation(): ArtistOperation | undefined {
  return artistOperations.getStore();
}
