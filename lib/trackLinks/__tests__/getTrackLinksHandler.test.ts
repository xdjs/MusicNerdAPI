import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackLinksCache } from "@/lib/trackLinks/const";
import { getTrackLinksHandler } from "@/lib/trackLinks/getTrackLinksHandler";

const apple = (results: unknown[]) => ({ ok: true, json: async () => ({ results }) });
const deezer = (data: unknown[]) => ({ ok: true, json: async () => ({ data }) });
let fetchMock: ReturnType<typeof vi.fn>;

async function ask({
  title,
  artist,
  kind = "song",
  appleBody = apple([]) as unknown,
  deezerBody = deezer([]) as unknown,
}: {
  title: string;
  artist: string;
  kind?: string;
  appleBody?: unknown;
  deezerBody?: unknown;
}) {
  fetchMock = vi.fn(async (url: string) =>
    String(url).includes("itunes.apple.com") ? appleBody : deezerBody,
  );
  vi.stubGlobal("fetch", fetchMock);
  const q = new URLSearchParams({ title, artist, kind });
  const res = await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q}`));
  return { status: res.status, body: await res.json(), headers: res.headers };
}

beforeEach(() => {
  trackLinksCache.clear();
  vi.unstubAllGlobals();
});

describe("getTrackLinksHandler", () => {
  it("returns the track on both services when they agree it is the right one, with CORS", async () => {
    const { body, headers } = await ask({
      title: "rush",
      artist: "Pete Rango",
      appleBody: apple([
        {
          trackName: "rush",
          artistName: "Pete Rango",
          trackViewUrl: "https://music.apple.com/x?uo=4",
        },
      ]),
      deezerBody: deezer([
        { title: "rush", artist: { name: "Pete Rango" }, link: "https://www.deezer.com/track/1" },
      ]),
    });
    expect(body).toEqual({
      links: [
        { service: "Apple Music", url: "https://music.apple.com/x" },
        { service: "Deezer", url: "https://www.deezer.com/track/1" },
      ],
    });
    expect(headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("accepts a track credited to someone else when the title carries the artist's mix credit", async () => {
    const { body } = await ask({
      title: "crying on the floor (pete rango mix)",
      artist: "Pete Rango",
      deezerBody: deezer([
        {
          title: "crying on the floor (pete rango mix)",
          artist: { name: "Dame Atlas" },
          link: "https://www.deezer.com/track/4094333431",
        },
      ]),
    });
    expect(body.links).toEqual([
      { service: "Deezer", url: "https://www.deezer.com/track/4094333431" },
    ]);
  });

  it("refuses a stranger's record with the same title", async () => {
    const { body } = await ask({
      title: "Thriller",
      artist: "Pete Rango",
      appleBody: apple([
        {
          trackName: "Thriller",
          artistName: "Michael Jackson",
          trackViewUrl: "https://music.apple.com/mj",
        },
      ]),
      deezerBody: deezer([
        {
          title: "Thriller",
          artist: { name: "Michael Jackson" },
          link: "https://www.deezer.com/track/2",
        },
      ]),
    });
    expect(body.links).toEqual([]);
  });

  it("ignores a collaborator list a caller tries to smuggle in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        deezer([
          {
            title: "Thriller",
            artist: { name: "Michael Jackson" },
            link: "https://www.deezer.com/track/12",
          },
        ]),
      ),
    );
    const q = new URLSearchParams({
      title: "Thriller",
      artist: "Pete Rango",
      with: "Michael Jackson",
    });
    const body = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q}`))
    ).json();
    expect(body.links).toEqual([]);
  });

  it("keeps the provider that answered when the other one fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("itunes.apple.com")) throw new Error("down");
        return deezer([
          { title: "rush", artist: { name: "Pete Rango" }, link: "https://www.deezer.com/track/4" },
        ]);
      }),
    );
    const q = new URLSearchParams({ title: "rush", artist: "Pete Rango" });
    const body = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q}`))
    ).json();
    expect(body.links).toEqual([{ service: "Deezer", url: "https://www.deezer.com/track/4" }]);
  });

  it("needs both a title and an artist", async () => {
    const { status, body } = await ask({ title: "", artist: "Pete Rango" });
    expect(status).toBe(400);
    expect(body).toEqual({ error: "title and artist are required" });
  });

  it("searches albums as albums, not as songs", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(String(url));
        return String(url).includes("itunes.apple.com")
          ? apple([
              {
                collectionName: "Cast Out Of Hell",
                artistName: "Pete Rango",
                collectionViewUrl: "https://music.apple.com/us/album/coh?uo=4",
              },
            ])
          : deezer([]);
      }),
    );
    const q = new URLSearchParams({
      title: "Cast Out Of Hell",
      artist: "Pete Rango",
      kind: "album",
    });
    const body = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q}`))
    ).json();
    expect(asked.some(u => u.includes("itunes.apple.com") && u.includes("entity=album"))).toBe(
      true,
    );
    expect(asked.some(u => u.includes("api.deezer.com/search/album"))).toBe(true);
    expect(body.links).toContainEqual({
      service: "Apple Music",
      url: "https://music.apple.com/us/album/coh",
    });
  });

  it("answers a completed search from memory, but never caches a provider failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    const q = () => new URLSearchParams({ title: "retry me", artist: "Pete Rango" });
    const first = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q()}`))
    ).json();
    expect(first).toEqual({ links: [] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("itunes.apple.com")
          ? apple([
              {
                trackName: "retry me",
                artistName: "Pete Rango",
                trackViewUrl: "https://music.apple.com/ok",
              },
            ])
          : deezer([]),
      ),
    );
    const second = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q()}`))
    ).json();
    expect(second).toEqual({
      links: [{ service: "Apple Music", url: "https://music.apple.com/ok" }],
    });

    vi.stubGlobal("fetch", vi.fn());
    const third = await (
      await getTrackLinksHandler(new Request(`https://api.test/api/trackLinks?${q()}`))
    ).json();
    expect(third).toEqual({
      links: [{ service: "Apple Music", url: "https://music.apple.com/ok" }],
      cached: true,
    });
  });
});
