import { it, expect, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { artistVaultSources: { findMany } } } }));
const { getVaultSourceUrlsByArtistId } = await import("@/lib/vault/getVaultSourceUrlsByArtistId");

it("reads only the URLs of the artist's sources, skipping empty ones", async () => {
  findMany.mockResolvedValue([{ url: "https://a.example/" }, { url: null }, { url: "" }]);
  expect(await getVaultSourceUrlsByArtistId("a1")).toEqual(["https://a.example/"]);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ columns: { url: true } }));
});
