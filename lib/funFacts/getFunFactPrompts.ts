import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { funfacts } from "@/lib/db/schema";

/** The active `funfacts` row: one prompt per kind of fact. */
export type FunFactPrompts = typeof funfacts.$inferSelect;

/**
 * The active fun fact prompts, as in MusicNerdWeb's `getPrompts`.
 *
 * @returns The active row, or null when there is none or the read failed.
 */
export async function getFunFactPrompts(): Promise<FunFactPrompts | null> {
  try {
    const result = await db.query.funfacts.findFirst({ where: eq(funfacts.isActive, true) });
    return result ?? null;
  } catch (error) {
    console.error("Error fetching funFacts prompts:", error);
    return null;
  }
}
