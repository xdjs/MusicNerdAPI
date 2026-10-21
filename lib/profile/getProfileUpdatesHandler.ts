import { NextResponse } from "next/server";
import { orderLatestItems } from "@/lib/artistLatest/orderLatestItems";
import { readArtistLatest } from "@/lib/artistLatest/readArtistLatest";
import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateProfileRequest } from "@/lib/profile/authenticateProfileRequest";
import { PROFILE_UPDATES_BATCH } from "@/lib/profile/const";
import { getContributedArtists } from "@/lib/profile/getContributedArtists";
import { matchesProfileUpdateFilter } from "@/lib/profile/matchesProfileUpdateFilter";
import { validateProfileUpdatesQuery } from "@/lib/profile/validateProfileUpdatesQuery";

type Card = Awaited<ReturnType<typeof readArtistLatest>>["items"][number];
type ProfileUpdate = Card & { artistId: string; artistName: string };

/**
 * GET /api/profile/updates: the stored Latest of the caller's artists, six
 * artists per page, two at a time, up to two cards each, newest first.
 * A provider whose snapshot failed or is missing is named in
 * `unavailableProviders`; an artist whose Latest could not be read makes it null.
 *
 * @param request - The request: a Privy bearer token, `X-Profile-Account`, and optional `offset` and `kind`.
 * @returns 200 `{ status: "ok", userId, items, checked, next, unavailable, unavailableProviders }`, or 400, 401, 409 or 503.
 */
export async function getProfileUpdatesHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateProfileRequest(request);
    if (auth instanceof NextResponse) return auth;
    const query = validateProfileUpdatesQuery(request);
    if (query instanceof NextResponse) return query;
    const { offset, filter } = query;
    const { artists: rows, total } = await getContributedArtists(auth.userId, {
      offset,
      limit: PROFILE_UPDATES_BATCH,
    });
    const items: ProfileUpdate[] = [];
    let unavailable = false;
    const unavailableProviders = new Set<string>();
    let unknownFailure = false;
    for (let index = 0; index < rows.length; index += 2) {
      await Promise.all(
        rows.slice(index, index + 2).map(async artist => {
          try {
            const latest = await readArtistLatest(artist.id, artist.name ?? "the artist");
            const incomplete = latest.coverage.filter(
              provider => provider.status === "failed" || provider.status === "missing",
            );
            if (incomplete.length > 0 || latest.unavailable) {
              unavailable = true;
              if (!incomplete.length) unknownFailure = true;
              incomplete.forEach(provider => unavailableProviders.add(provider.provider));
            }
            items.push(
              ...orderLatestItems(latest.items)
                .filter(item => matchesProfileUpdateFilter(item.kind, filter))
                .slice(0, 2)
                .map(item => ({
                  ...item,
                  id: `${artist.id}:${item.id}`,
                  artistId: artist.id,
                  artistName: artist.name || "Unknown artist",
                })),
            );
          } catch {
            unavailable = true;
            unknownFailure = true;
          }
        }),
      );
    }
    const checked = offset + rows.length;
    return NextResponse.json(
      {
        status: "ok",
        userId: auth.userId,
        items: items.sort(
          (a, b) =>
            latestActivityTime(b.date) - latestActivityTime(a.date) || a.id.localeCompare(b.id),
        ),
        checked,
        next: checked < total ? checked : null,
        unavailable,
        unavailableProviders: unknownFailure ? null : [...unavailableProviders].sort(),
      },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load artist updates" },
      { status: 503, headers },
    );
  }
}
