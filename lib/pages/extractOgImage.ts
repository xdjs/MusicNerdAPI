import { isIP } from "node:net";
import { isPublicAddress } from "@/lib/sourceExtraction/isPublicAddress";
import { parse, type DefaultTreeAdapterMap } from "parse5";

/**
 * Read a usable page-declared HTTPS image, preferring Open Graph to Twitter.
 * No image is fetched; unsupported or unsafe metadata falls back to no image.
 * @param html - The specific source page's HTML.
 * @returns A public HTTPS image URL, or null.
 */
export function extractOgImage(html: string): string | null {
  const nodes: DefaultTreeAdapterMap["node"][] = [parse(html)];
  const candidates: Record<string, string[]> = { "og:image": [], "twitter:image": [] };
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if ("childNodes" in node) nodes.push(...node.childNodes);
    if (!("tagName" in node) || node.tagName !== "meta") continue;
    const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
    const kind = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if ((kind === "og:image" || kind === "twitter:image") && attrs.content)
      candidates[kind].push(attrs.content.trim());
  }
  for (const candidate of [...candidates["og:image"], ...candidates["twitter:image"]]) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        (!isIP(host) || isPublicAddress(host)) &&
        host !== "localhost" &&
        host !== "local" &&
        !host.endsWith(".localhost") &&
        !host.endsWith(".local")
      )
        return url.href;
    } catch {
      /* Invalid metadata is not a thumbnail. */
    }
  }
  return null;
}
