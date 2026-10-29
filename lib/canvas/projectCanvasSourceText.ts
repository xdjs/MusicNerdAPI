/** Project recognized public metadata as labeled facts; unknown JSON is a link-only source. */
export function projectCanvasSourceText(text: string, sourceUrl: string) {
  const plain = {
    text,
    metadata: false,
    title: undefined as string | undefined,
    attribution: undefined as string | undefined,
  };
  if (!/^\s*(?:\{\s*["}]|\[\s*[\[{"\]\d])/.test(text)) return plain;
  const empty = { ...plain, text: "", metadata: true };
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
    const data = value as Record<string, unknown>;
    const host = new URL(sourceUrl).hostname;
    const string = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : undefined;
    if (host === "inprocess.world" || host.endsWith(".inprocess.world"))
      return {
        ...plain,
        text: string(data.description) ? String(data.description) : "",
        title: string(data.title),
        attribution: "InProcess · work description",
      };
    const provider = data.provider;
    const matched =
      (provider === "deezer" && (host === "deezer.com" || host.endsWith(".deezer.com"))) ||
      (provider === "spotify" && host === "open.spotify.com") ||
      (provider === "bandcamp" && host.endsWith(".bandcamp.com"));
    const title = string(data.title);
    if (!matched || !title) return empty;
    const artist =
      string(data.artist_name) ??
      string(
        typeof data.artist === "object" && data.artist
          ? (data.artist as Record<string, unknown>).name
          : data.artist,
      );
    const type = string(data.release_type);
    const date = string(data.release_date);
    return {
      title,
      metadata: true,
      attribution: `${provider === "deezer" ? "Deezer" : provider === "spotify" ? "Spotify" : "Bandcamp"} · stored release metadata`,
      text: [
        `Title: ${title}`,
        artist ? `Artist: ${artist}` : "",
        type && /^(album|ep|single|compilation)$/i.test(type)
          ? `Type: ${type.toLowerCase() === "ep" ? "EP" : type}`
          : "",
        date && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date) ? `Release date: ${date}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  } catch {
    return empty;
  }
}
