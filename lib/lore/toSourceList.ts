import type { DocMaterial, DocSource } from "@/lib/lore/types";
import { byAuthority } from "@/lib/sources/byAuthority";

/**
 * The numbered manifest the model cites into and the page renders from. Order
 * is fixed (vault best-first, then interview, then social), so the same
 * material always gets the same ids.
 *
 * @param m - The material, from `gatherDocMaterial`.
 * @returns The numbered sources.
 */
export function toSourceList(m: DocMaterial): DocSource[] {
  const sources: DocSource[] = [];
  let nextId = 1;
  // MusicNerdWeb passes `siteName` as the type, a column the table doesn't
  // have, so every vault source ranks by host alone. Kept identical here.
  const rankedVault = byAuthority(m.vaultSources, s => ({ url: s.url, type: null }));
  for (const s of rankedVault) {
    sources.push({
      id: nextId++,
      kind: "vault",
      label: s.title ?? s.url,
      url: s.url,
      publishedAt: s.publishedAt ?? null,
    });
  }
  for (const a of m.answers) {
    sources.push({
      id: nextId++,
      kind: "interview",
      label: `Their own words — "${a.question}"`,
      url: null,
    });
  }
  for (const c of m.socialCollaborators) {
    sources.push({
      id: nextId++,
      kind: "social",
      label: `Instagram collaboration with @${c.handle}`,
      url: c.url,
    });
  }
  for (const c of m.creditedCollaborators) {
    const label = `${m.artistName} credits ${c.isHandle ? "@" : ""}${c.subject} — ${c.roles.join("; ")}`;
    sources.push({ id: nextId++, kind: "social", label, url: c.url });
  }
  for (const c of m.selfCredits) {
    sources.push({
      id: nextId++,
      kind: "social",
      label: `${m.artistName} on their own role — ${c.role}`,
      url: c.url,
    });
  }
  for (const s of m.artistStatements) {
    const label = `Their own words — ${s.topic}: "${s.quote.slice(0, 180)}"`;
    sources.push({ id: nextId++, kind: "social", label, url: s.url });
  }
  for (const r of m.socialMusicRefs) {
    sources.push({
      id: nextId++,
      kind: "social",
      label: `Track credit — "${r.title}" (${r.artist})`,
      url: r.url,
    });
  }
  for (const video of m.videoContexts ?? []) {
    sources.push({
      id: nextId++,
      kind: "social",
      label: "Instagram reel audio context (speaker unverified)",
      url: video.url,
    });
  }
  return sources;
}
