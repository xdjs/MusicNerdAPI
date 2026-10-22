import { getAllLinks } from "@/lib/artists/getAllLinks";
import { VALIDATED_PLATFORMS, type ValidatedPlatform } from "@/lib/validateLink/const";

/**
 * The platforms `validateLink` checks, each with the urlmap pattern when the
 * table has a valid one for it (`ens` and `wallets` never apply), else the
 * built-in one. A failed urlmap read keeps the built-in patterns.
 *
 * @returns The platforms in MusicNerdWeb's order.
 */
export async function getValidatedPlatforms(): Promise<ValidatedPlatform[]> {
  const regexMap: Record<string, string> = {};
  try {
    for (const link of await getAllLinks()) {
      if (link.siteName === "ens" || link.siteName === "wallets") continue;
      if (typeof link.regex === "string" && link.regex.trim().length > 0)
        regexMap[link.siteName] = link.regex.trim();
    }
  } catch (e) {
    console.error("Failed to fetch platform regexes from DB:", e);
  }
  return VALIDATED_PLATFORMS.map(platform => {
    const dbRegex = regexMap[platform.name];
    if (!dbRegex) return platform;
    try {
      return { ...platform, regex: new RegExp(dbRegex) };
    } catch (err) {
      console.error(`Invalid regex from DB for ${platform.name}:`, dbRegex, err);
      return platform;
    }
  });
}
