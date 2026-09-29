import type { SearchRun } from "@/lib/vault/types";

/**
 * Whether the run's deadline has passed before a phase starts. Checking
 * between phases doesn't cancel work in flight, but it stops us starting a
 * phase that writes after the caller has moved on.
 *
 * @param run - The run, for its deadline and whether it must complete.
 * @param phase - The phase about to start, for the log and the error.
 * @returns True when out of time. Throws instead for a durable job, which must retry rather than finish partial.
 */
export function outOfBudget(
  run: Pick<SearchRun, "deadline" | "requireComplete">,
  phase: string,
): boolean {
  if (Date.now() < run.deadline) return false;
  if (run.requireComplete) throw new Error(`Source search deadline exhausted before ${phase}`);
  console.log(
    `[vaultWebSearch] Out of time before ${phase} — stopping rather than writing behind the caller`,
  );
  return true;
}
