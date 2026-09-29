import { AsyncLocalStorage } from "node:async_hooks";
import type { ArtistOperation } from "@/lib/ownership/types";

/**
 * The running artist operation, carried across async discovery work. One
 * instance for the process: `withArtistOperation` sets it and every scoped
 * write reads it.
 */
export const artistOperations = new AsyncLocalStorage<ArtistOperation>();
