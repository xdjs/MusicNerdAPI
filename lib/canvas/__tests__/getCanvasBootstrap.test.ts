import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { getCanvasBootstrap } from "../getCanvasBootstrap";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
vi.mock("../readCanvasPreviewBudget", () => ({
  readCanvasPreviewBudget: async () => null,
}));
const mocks = vi.hoisted(() => ({ artist: vi.fn(), originals: vi.fn() }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mocks.artist }));
vi.mock("../loadCanvasStoredOriginals", () => ({ loadCanvasStoredOriginals: mocks.originals }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("MUSICNERD_CANVAS_PREVIEW_ENABLED", "1");
  mocks.artist.mockResolvedValue({ id, name: "Third Artist", privateNotes: "must not leak" });
  mocks.originals.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
it("opens arbitrary artists without borrowing another artist's seed", async () => {
  const result = await (await getCanvasBootstrap(id)).json();
  expect(result.artist).toEqual({
    id,
    name: "Third Artist",
    profileUrl: `/artist/${id}?view=profile`,
  });
  expect(result.evidence).toEqual([]);
  expect(result.generationEnabled).toBe(true);
  expect(result.coverage).toContain("No readable");
});
it("adapts real saved source text for an arbitrary artist", async () => {
  mocks.originals.mockResolvedValue([
    originalFixture("source:third", "https://example.com/third", "A documented public source."),
  ]);
  const result = await (await getCanvasBootstrap(id)).json();
  expect(result.evidence[0].text).toBe("A documented public source.");
  expect(result.sourceCount).toBe(1);
});
it("fails closed outside preview and handles missing artists", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  expect((await getCanvasBootstrap(id)).status).toBe(404);
  expect(mocks.artist).not.toHaveBeenCalled();
  vi.stubEnv("VERCEL_ENV", "preview");
  mocks.artist.mockResolvedValue(null);
  expect((await getCanvasBootstrap(id)).status).toBe(404);
});

it("opens with a public introduction and keeps retained social imagery among a large archive", async () => {
  const archive = Array.from({ length: 12 }, (_, n) =>
    originalFixture(`vault:${n}`, `https://example.com/${n}`, "Archive source."),
  );
  mocks.originals.mockResolvedValue([
    ...archive,
    {
      ...originalFixture(
        `public_profile:${id}`,
        "https://example.com/profile",
        "Third Artist makes recorded music.",
      ),
    },
    {
      ...originalFixture(
        "social:post",
        "https://www.instagram.com/p/verified/",
        "A dated public post.",
      ),
      mediaKind: "instagram",
      image: "https://example.com/retained.webp",
    },
  ]);
  const result = await (await getCanvasBootstrap(id)).json();
  expect(result.introduction.text).toBe("Third Artist makes recorded music.");
  expect(result.openingIds).toContain("social:post");
  expect(result.openingIds).not.toContain(`public_profile:${id}`);
  expect(result.evidence).toHaveLength(8);
  expect(result.openingSuggestions.length).toBeGreaterThan(0);
});
