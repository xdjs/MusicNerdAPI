import { resolveOutboundHandles } from "@/lib/vault/resolveOutboundHandles";
import { findCorroborator } from "@/lib/vault/findCorroborator";
import { ACCOUNT_PLATFORMS } from "@/lib/vault/const";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import type { DirectoryMaterial, PublicAbout } from "./types";
/** Prefer an exact labeled bio from the assessed artist account itself, never a name-matched domain. */
export async function selectOfficialAbout(
  material: DirectoryMaterial,
): Promise<PublicAbout | null> {
  if (!material.accounts) return null;
  for (const source of material.manifest) {
    if (!normalizePublicUrl(source.url) || isUnsafeUrl(source.url)) continue;
    const match = source.extractedText.match(
      /(?:^|\n)[ \t]*(?:#{1,6}[ \t]+)?(?:biography|bio|about)[ \t]*\r?\n+[ \t]*([^\n]+(?:\n(?![ \t]*\n)[^\n]+)*)/i,
    );
    const bio = match?.[1].trim();
    if (!bio || bio.length < 80 || bio.length > 1500) continue;
    const handles = await resolveOutboundHandles([source.url]);
    const owned = findCorroborator(
      handles.filter(
        handle =>
          !handle.corroborationOnly &&
          ACCOUNT_PLATFORMS.has(handle.siteName) &&
          !isReservedHandle(handle.siteName, handle.id),
      ),
      material.accounts,
    );
    if (!owned) continue;
    const parsedUrl = new URL(source.url);
    const domain =
      owned.siteName === "youtubechannel"
        ? "youtube.com"
        : owned.siteName === "spotify"
          ? "spotify.com"
          : `${owned.siteName}.com`;
    if (parsedUrl.hostname !== domain && !parsedUrl.hostname.endsWith(`.${domain}`)) continue;
    const path = parsedUrl.pathname.split("/").filter(Boolean);
    const profilePath =
      owned.siteName === "bandcamp"
        ? path.length === 0
        : owned.siteName === "spotify"
          ? path.length === 2 && path[0] === "artist"
          : owned.siteName === "youtubechannel"
            ? path.length === 2 && path[0] === "channel"
            : path.length === 1;
    if (!profilePath) continue;
    return {
      version: 1,
      identity: { name: material.artistName, accounts: material.accounts ?? {} },
      bio,
      kind: "official",
      sources: [
        {
          id: source.id,
          url: source.url,
          label: (source.title || new URL(source.url).hostname).slice(0, 300),
        },
      ],
      ownership: { siteName: owned.siteName, id: material.accounts[owned.siteName] },
    };
  }
  return null;
}
