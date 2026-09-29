import type { PageContent } from "@/lib/pages/types";

/**
 * Why a fetch never completed. Only a nonexistent hostname is evidence the URL
 * was invented; a timeout says nothing about whether the page is real. Node
 * puts the syscall error on `cause`.
 *
 * @param e - What the fetch threw.
 * @returns "dns", "timeout" or "network".
 */
export function fetchFailureKind(e: unknown): NonNullable<PageContent["failure"]> {
  const code = (e as { cause?: { code?: string } } | undefined)?.cause?.code;
  const name = (e as { name?: string } | undefined)?.name;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  return "network";
}
