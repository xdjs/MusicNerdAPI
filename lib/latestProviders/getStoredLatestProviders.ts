import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";
import type { ResearchOriginal } from "@/lib/questionResearch/types";
import { latestProviderAccount } from "./latestProviderAccount";
import { latestActivityTime } from "./latestActivityTime";
import type { LatestProvider, LatestProviderItem, LatestProviderCoverage } from "./types";

/** Local-only current public projection. Stale snapshots remain known evidence, never silently current. */
export async function getStoredLatestProviders(
  artistId: string,
  store: Pick<TransactionDb, "execute"> = db,
  now = Date.now(),
) {
  const [artist] = await store.execute<{
    spotify: string | null;
    deezer: string | null;
    inprocess: string | null;
  }>(sql`select spotify,deezer,inprocess from artists where id=${artistId}::uuid`);
  if (!artist) throw new KnowledgeError("not_found", 404, "Artist unavailable");
  const rows = await store.execute<{
    provider: LatestProvider;
    account_id: string;
    items: LatestProviderItem[];
    checked_at: string | Date | null;
    last_attempt_at: string | Date;
    status: "checked" | "failed";
  }>(
    sql`select provider,account_id,items,checked_at,last_attempt_at,status from artist_latest_provider_snapshots where artist_id=${artistId}::uuid`,
  );
  const retained: Array<LatestProviderItem & { retrievedAt: string | null }> = [];
  const coverage: LatestProviderCoverage[] = [];
  for (const provider of ["spotify", "deezer", "inprocess"] as const) {
    const account = latestProviderAccount(provider, artist[provider]);
    const row = account
      ? rows.find(r => r.provider === provider && r.account_id === account)
      : undefined;
    const checkedAt = row?.checked_at ? new Date(row.checked_at).toISOString() : null;
    const stale =
      Boolean(account) &&
      (!checkedAt || now - Date.parse(checkedAt) > (provider === "inprocess" ? 600000 : 86400000));
    coverage.push({
      provider,
      status: !account ? "disconnected" : !row ? "missing" : row.status,
      checkedAt,
      lastAttemptAt: row ? new Date(row.last_attempt_at).toISOString() : null,
      stale,
    });
    if (!row || !checkedAt) continue;
    if (!Array.isArray(row.items) || row.items.length > 50)
      throw new Error("Invalid Latest snapshot");
    for (const item of row.items) {
      if (
        !item.card ||
        !item.original ||
        !item.original.sourceId.startsWith(`latest:${provider}:`) ||
        item.card.sourceId !== item.original.sourceId ||
        item.card.revision !== item.original.revision
      )
        throw new Error("Invalid Latest original");
      const time = latestActivityTime(item.card.date);
      if (!Number.isFinite(time) || time > now) continue;
      retained.push({ ...item, retrievedAt: checkedAt });
    }
  }
  const moments = retained
    .filter(i => i.card.kind === "moment")
    .sort(
      (a, b) =>
        latestActivityTime(b.card.date) - latestActivityTime(a.card.date) ||
        a.card.id.localeCompare(b.card.id),
    )
    .slice(0, 12);
  const groups = new Map<string, (typeof retained)[number]>();
  for (const item of retained.filter(i => i.card.kind === "release")) {
    const key = `${item.card.title.trim().toLocaleLowerCase("en-US")}|${item.card.date}|${item.card.text}`;
    const old = groups.get(key);
    if (old)
      old.card = {
        ...old.card,
        listeningLinks: [...(old.card.listeningLinks ?? []), ...(item.card.listeningLinks ?? [])],
      };
    else groups.set(key, { ...item, card: { ...item.card } });
  }
  const releases = [...groups.values()]
    .sort(
      (a, b) =>
        latestActivityTime(b.card.date) - latestActivityTime(a.card.date) ||
        a.card.id.localeCompare(b.card.id),
    )
    .slice(0, 3);
  const selected = [...moments, ...releases].sort(
    (a, b) =>
      latestActivityTime(b.card.date) - latestActivityTime(a.card.date) ||
      a.card.id.localeCompare(b.card.id),
  );
  const originals: ResearchOriginal[] = selected.map(i => ({
    ...i.original,
    retrievedAt: i.retrievedAt,
  }));
  return {
    items: selected.map(i => i.card),
    originals,
    coverage,
    unavailable: coverage.some(c => c.status === "failed" || c.status === "missing"),
  };
}
