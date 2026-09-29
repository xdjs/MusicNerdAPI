import type { DocSource } from "@/lib/lore/types";

/**
 * The numbered SOURCES manifest the model cites into, last in the prompt.
 *
 * @param sources - The numbered sources.
 * @returns The block, or "" with no sources.
 */
export function sourceManifestBlock(sources: DocSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map(s => {
    if (s.kind === "vault") return `[${s.id}] APPROVED SOURCE — "${s.label}" (${s.url})`;
    if (s.kind === "interview") return `[${s.id}] INTERVIEW — ${s.label}`;
    return `[${s.id}] SOCIAL SIGNAL — ${s.label} (${s.url})`;
  });
  return `\n--- NUMBERED SOURCES (cite these ids as [n]) ---\n${lines.join("\n")}\n--- END SOURCES ---`;
}
