import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import type { LatestProvider, LatestProviderItem, LatestProviderCard } from "./types";

/** Normalize only provider fields; metadata descriptions are never media transcripts. */
export function normalizeLatestProviderItems(
  provider: LatestProvider,
  accountId: string,
  body: unknown,
): LatestProviderItem[] {
  const object = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const string = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const https = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password && !u.port ? u.href : null;
    } catch {
      return null;
    }
  };
  const image = (v: unknown): string | null => {
    const raw = string(v);
    if (!raw) return null;
    if (provider === "inprocess" && raw.startsWith("ipfs://"))
      return https(
        `https://magic.decentralized-content.com/ipfs/${raw.slice(7).replace(/^ipfs\//, "")}`,
      );
    if (provider === "inprocess" && raw.startsWith("ar://"))
      return https(`https://arweave.net/${raw.slice(5)}`);
    const url = https(raw);
    if (!url) return null;
    const host = new URL(url).hostname;
    return provider === "inprocess" ||
      (provider === "spotify"
        ? /(^|\.)(scdn.co|spotifycdn.com)$/.test(host)
        : /(^|\.)(dzcdn.net|deezer.com)$/.test(host))
      ? url
      : null;
  };
  const root = object(body);
  const rows = root[provider === "spotify" ? "items" : provider === "deezer" ? "data" : "moments"];
  if (!Array.isArray(rows) || root.error) throw new Error("Invalid Latest provider response");
  const result: LatestProviderItem[] = [];
  for (const value of rows.slice(0, provider === "inprocess" ? 12 : 50)) {
    const row = object(value);
    const id =
      typeof row.id === "number" && Number.isSafeInteger(row.id) ? String(row.id) : string(row.id);
    if (!id) continue;
    let card: Omit<LatestProviderCard, "sourceId" | "revision">;
    let fields: Record<string, unknown>;
    if (provider === "inprocess") {
      const hidden = Array.isArray(row.hidden) ? row.hidden : [];
      if (hidden.some(v => typeof v === "string" && v.toLowerCase() === accountId.toLowerCase()))
        continue;
      const address = string(row.address);
      const token =
        typeof row.token_id === "number" && Number.isSafeInteger(row.token_id)
          ? String(row.token_id)
          : string(row.token_id);
      const date = string(row.created_at);
      if (
        !address ||
        !/^0x[a-f0-9]{40}$/i.test(address) ||
        !token ||
        !/^\d+$/.test(token) ||
        !date ||
        !Number.isFinite(Date.parse(date))
      )
        continue;
      const metadata = object(row.metadata);
      const title =
        string(metadata.name) ?? string(object(row.collection).name) ?? "Untitled moment";
      const description = typeof metadata.description === "string" ? metadata.description : null;
      if (title.length > 1000 || (description?.length ?? 0) > 20000)
        throw new Error("Latest moment exceeds text budget");
      const mime = string(object(metadata.content).mime)?.toLowerCase() ?? "";
      const kind = mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : mime.startsWith("image/")
            ? "image"
            : mime.startsWith("text/") || mime === "application/pdf"
              ? "writing"
              : "other";
      const chain = (
        { 8453: "base", 84532: "bsep", 1: "eth", 10: "op", 7777777: "zora" } as Record<
          number,
          string
        >
      )[Number(row.chain_id)];
      // Unknown chains retain Web's known artist profile fallback, never construct an invented collect path.
      const url = chain
        ? `https://www.inprocess.world/collect/${chain}:${address}/${token}`
        : `https://www.inprocess.world/${accountId}`;
      card = {
        id: `moment:${id}`,
        kind: "moment",
        momentKind: kind,
        title,
        text: description?.trim() || `${kind[0].toUpperCase()}${kind.slice(1)} on In Process`,
        date,
        imageUrl: image(metadata.image),
        imageCaption: `${title} artwork`,
        sourceUrl: url,
        sourceLabel: "Open on In Process",
      };
      fields = {
        provider: "inprocess",
        timeline_account: accountId,
        id,
        title: string(metadata.name),
        collection_name: string(object(row.collection).name),
        description,
        created_at: date,
        mime: mime || null,
      };
    } else {
      if (!(provider === "spotify" ? /^[a-zA-Z0-9]{22}$/.test(id) : /^[1-9]\d*$/.test(id)))
        continue;
      const title = string(provider === "spotify" ? row.name : row.title);
      const kind = provider === "spotify" ? row.album_type : row.record_type;
      const date = string(row.release_date);
      if (
        !title ||
        title.length > 1000 ||
        !date ||
        !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date) ||
        !["album", "single", ...(provider === "deezer" ? ["ep"] : [])].includes(String(kind)) ||
        row.album_group === "appears_on"
      )
        continue;
      const url = https(provider === "spotify" ? object(row.external_urls).spotify : row.link);
      if (!url) continue;
      const parsed = new URL(url);
      if (
        provider === "spotify"
          ? parsed.hostname !== "open.spotify.com" || parsed.pathname !== `/album/${id}`
          : !["deezer.com", "www.deezer.com"].includes(parsed.hostname) ||
            !new RegExp(`^/(?:[a-z]{2}/)?album/${id}/?$`).test(parsed.pathname)
      )
        continue;
      const covers =
        provider === "spotify"
          ? Array.isArray(row.images)
            ? row.images.map(v => object(v).url)
            : []
          : [row.cover_big, row.cover_xl, row.cover_medium, row.cover];
      const label = provider === "spotify" ? "Spotify" : "Deezer";
      card = {
        id: `release:${provider}:${id}`,
        kind: "release",
        title,
        text: String(kind),
        date,
        imageUrl: covers.map(image).find(Boolean) ?? null,
        imageCaption: `${title} artwork`,
        sourceUrl: url,
        sourceLabel: `Listen on ${label}`,
        listeningLinks: [
          { siteName: provider, href: url, label, iconSrc: `/siteIcons/${provider}_icon.svg` },
        ],
      };
      fields = {
        provider,
        artist_account: accountId,
        id,
        title,
        release_type: kind,
        release_date: date,
      };
    }
    const sourceId = `latest:${provider}:${knowledgeRevision({ accountId, id })}`;
    const text = JSON.stringify(fields, null, 2);
    const activityDateKind = provider === "inprocess" ? ("moment" as const) : ("release" as const);
    const revision = knowledgeRevision({
      text,
      url: card.sourceUrl,
      activityDate: card.date,
      activityDateKind,
    });
    result.push({
      card: { ...card, sourceId, revision },
      original: {
        sourceId,
        revision,
        text,
        url: card.sourceUrl,
        curation: "approved",
        evidenceKind: "original_text",
        speaker: provider === "inprocess" ? "unverified" : "not_applicable",
        publishedAt: null,
        activityDate: card.date,
        activityDateKind,
        truncated: false,
      },
    });
  }
  return result;
}
