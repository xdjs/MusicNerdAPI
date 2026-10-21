import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchArtistsBatchCache } from "@/lib/artistSearch/const";

const { local } = vi.hoisted(() => ({ local: vi.fn() }));
vi.mock("@/lib/artistSearch/searchForArtistByName", () => ({ searchForArtistByName: local }));
const { postSearchArtistsBatchHandler } =
  await import("@/lib/artistSearch/postSearchArtistsBatchHandler");

const post = (body: string) =>
  postSearchArtistsBatchHandler(
    new Request("https://api.test/api/searchArtists/batch", { method: "POST", body }),
  );
const row = (id: string, name: string) => ({
  id,
  name,
  bio: "private",
  customImage: null,
  match_type: 0,
});

beforeEach(() => {
  local.mockReset();
  searchArtistsBatchCache.clear();
});

describe("postSearchArtistsBatchHandler", () => {
  it("returns the best match per name in request order, null where none, with bio hidden", async () => {
    local
      .mockResolvedValueOnce([row("a2", "Sigur Rós Tribute"), row("a1", "Sigur Rós")])
      .mockResolvedValueOnce([]);
    const r = await post('{"query":{"artists":["sigur ros","nobody"]}}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      results: [
        {
          id: "a1",
          name: "Sigur Rós",
          customImage: null,
          match_type: 0,
          bio: null,
          isSpotifyOnly: false,
          matchScore: 0,
        },
        null,
      ],
    });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("serves the same list from memory", async () => {
    local.mockResolvedValueOnce([row("a1", "Pete")]);
    await post('{"query":{"artist":"pete"}}');
    const again = await post('{"query":{"artists":["pete"]}}');
    expect((await again.json()).results[0].id).toBe("a1");
    expect(local).toHaveBeenCalledTimes(1);
  });

  it("answers 400 without names and 500 when a search or the body fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await post('{"query":{"artists":[]}}');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "No queries provided" });
    local.mockRejectedValueOnce(new Error("db"));
    expect((await post('{"query":{"artist":"x"}}')).status).toBe(500);
    expect((await post("nope")).status).toBe(500);
    error.mockRestore();
  });
});
