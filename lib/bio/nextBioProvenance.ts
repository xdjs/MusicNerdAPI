import { createHash } from "node:crypto";

/** Preserve evidence lineage across edits; never infer historical evidence from today's Lore. */
export function nextBioProvenance(
  bio: string,
  previousBio: string | null,
  previous: unknown,
  generation?: {
    generated: boolean;
    claimId: string | null;
    sources?: unknown[];
    authored?: boolean;
  },
): unknown {
  const bioHash = createHash("sha256").update(bio).digest("hex");
  const unknown = { version: 1, kind: "unknown", bioHash };
  if (generation?.generated) {
    if (!generation.sources) return unknown;
    return {
      version: 1,
      kind: generation.authored ? "authored" : "generated",
      bioHash,
      claimId: generation.claimId,
      sources: structuredClone(generation.sources),
    };
  }
  if (previous == null) return null;
  if (bio === previousBio) return previous;
  if (typeof previous !== "object" || Array.isArray(previous)) return unknown;
  const p = previous as Record<string, unknown>;
  if (
    p.version !== 1 ||
    typeof p.kind !== "string" ||
    !["generated", "authored"].includes(p.kind) ||
    !Array.isArray(p.sources) ||
    !(p.claimId === null || typeof p.claimId === "string") ||
    p.bioHash !==
      createHash("sha256")
        .update(previousBio ?? "")
        .digest("hex")
  )
    return unknown;
  return { ...p, bioHash };
}
