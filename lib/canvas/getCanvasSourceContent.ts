import type { CanvasResearchOriginal } from "./const";
/** Narrow recognizable Bandcamp album pages to their own track/about/credit section, never adjacent catalog navigation. */
export function getCanvasSourceContent(source: CanvasResearchOriginal) {
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return { text: source.text, title: "Stored source", album: false, scoped: false };
  }
  if (!url.hostname.endsWith("bandcamp.com") || !url.pathname.startsWith("/album/"))
    return {
      text: source.text,
      title: source.pdf?.title ?? url.hostname,
      album: false,
      scoped: false,
    };
  const first = source.text.split("\n")[0].trim();
  const title =
    first.includes(" | ") && first.length < 200
      ? first.split(" | ")[0]
      : decodeURIComponent(url.pathname.slice(7)).replace(/-/g, " ");
  const about = /^\s*(?:#{1,6}\s*)?about\s*$/im.exec(source.text);
  const rest = about ? source.text.slice(about.index) : "";
  const credits = /^\s*(?:#{1,6}\s*)?credits\s*$/im.exec(rest);
  const license = /^\s*(?:#{1,6}\s*)?license\s*$/im.exec(rest);
  if (!about || !credits || !license || credits.index > license.index)
    return { text: source.text, title, album: true, scoped: false };
  const before = source.text.slice(0, about.index);
  const tracks = /^\s*1\.\s*$/m.exec(before);
  const body = source.text.slice(tracks?.index ?? about.index, about.index + license.index);
  return { text: `${title}\n${body.trim()}`, title, album: true, scoped: true };
}
