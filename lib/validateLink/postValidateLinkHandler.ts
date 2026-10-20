import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAllLinks } from "@/lib/artists/getAllLinks";

/** Platform definitions with error detection phrases. */
const platforms = [
  {
    name: "youtube",
    regex: /^https?:\/\/(www\.)?youtube\.com\/(?:@([^\/?#]+)|([^\/?#]+))(?:[\/?#].*)?$/,
    errorPhrases: [
      "This page isn't available",
      "404 Not Found",
      "Channel does not exist",
      "has been terminated",
      "is not available",
    ],
  },
  {
    name: "youtubechannel",
    regex: /^https?:\/\/(www\.)?youtube\.com\/channel\/([^\/?#]+)(?:[\/?#].*)?$/,
    errorPhrases: ["This page isn't available", "404 Not Found", "Channel does not exist", "has been terminated"],
  },
  {
    name: "soundcloud",
    regex: /^https?:\/\/(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+/,
    errorPhrases: ["Sorry! We can't find that user.", "We can't find that user.", "We couldn't find that page."],
  },
  {
    name: "bandcamp",
    regex: /^https?:\/\/(?:([A-Za-z0-9_-]+)\.bandcamp\.[^\/]+|(?:www\.)?bandcamp\.com\/[A-Za-z0-9_-]+)/,
    errorPhrases: ["Sorry, that something isn't here.", "404 Not Found"],
  },
  {
    name: "audius",
    regex: /^https?:\/\/(www\.)?audius\.co\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "User not found"],
  },
  {
    name: "lastfm",
    regex: /^https?:\/\/(www\.)?last\.fm\/(user|music)\/[A-Za-z0-9_-]+/,
    errorPhrases: ["User not found", "404 Not Found"],
  },
  {
    name: "opensea",
    regex: /^https?:\/\/(www\.)?opensea\.io\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "This page could not be found"],
  },
  {
    name: "zora",
    regex: /^https?:\/\/(www\.)?zora\.co\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "This page could not be found"],
  },
  {
    name: "catalog",
    regex: /^https?:\/\/(www\.)?catalog\.works\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "This page could not be found"],
  },
  {
    name: "supercollector",
    regex: /^https?:\/\/(www\.)?supercollector\.xyz\/[A-Za-z0-9_-]+/,
    errorPhrases: ["404 Not Found", "This page could not be found"],
  },
] as { name: string; regex: RegExp; errorPhrases: string[] }[];

/**
 * Validates an artist link URL by matching it to a known platform, fetching it,
 * and checking the response for error indicators. Returns `{ valid: true }` or
 * `{ valid: false, reason }`.
 *
 * @param request - The request with a JSON body containing `{ url }`.
 * @returns The validation result.
 */
export async function postValidateLinkHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid request body" },
      { status: 400, headers },
    );
  }

  const url = body?.url;
  if (!url || typeof url !== "string")
    return NextResponse.json({ valid: false, reason: "No URL provided" }, { status: 400, headers });

  // Overlay DB regexes on the built-in patterns
  try {
    const allLinks = await getAllLinks();
    const regexMap: Record<string, string> = {};
    for (const link of allLinks) {
      if (link.siteName === "ens" || link.siteName === "wallets") continue;
      if (typeof link.regex === "string" && link.regex.trim().length > 0)
        regexMap[link.siteName] = link.regex.trim();
    }
    for (const p of platforms) {
      const dbRegex = regexMap[p.name];
      if (dbRegex) {
        try {
          p.regex = new RegExp(dbRegex);
        } catch {
          /* keep built-in */
        }
      }
    }
  } catch {
    /* best-effort; fall through to built-in regexes */
  }

  const platform = platforms.find(p => p.regex.test(url));
  if (!platform)
    return NextResponse.json(
      { valid: false, reason: "Unsupported platform or invalid URL" },
      { status: 400, headers },
    );

  try {
    const response = await fetch(url, { method: "GET" });
    if (response.status === 404)
      return NextResponse.json({ valid: false, reason: "404 Not Found" }, { headers });

    if (response.status === 200) {
      if (platform.name === "soundcloud" && response.url.includes("/404"))
        return NextResponse.json({ valid: false, reason: "soundcloud 404 redirect" }, { headers });

      const text = await response.text();
      for (const phrase of platform.errorPhrases) {
        if (text.toLowerCase().includes(phrase.toLowerCase()))
          return NextResponse.json({ valid: false, reason: `${platform.name} error page` }, { headers });
      }
    }

    return NextResponse.json({ valid: true }, { headers });
  } catch {
    return NextResponse.json({ valid: false, reason: "Network error or invalid URL" }, { headers });
  }
}
