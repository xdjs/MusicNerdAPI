import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { disconnectCatalogLink } from "@/lib/artistLinks/disconnectCatalogLink";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
const artist = "00000000-0000-4000-8000-000000001580";
const actor = "00000000-0000-4000-8000-000000001581";
const claim = "00000000-0000-4000-8000-000000001582";
const run = (value: string | null | undefined) =>
  withArtistOperation(artist, { userId: actor, expectedClaimId: claim }, () =>
    disconnectCatalogLink(artist, "deezer", value),
  );
beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { snapshot: { id: "m", platform_id: "101", api_key_hash: "private-original" } },
    ])
    .mockResolvedValueOnce([{ old_value: "101" }]);
});
it("captures full mapping under slot lock, derives actor from scope, and returns only old ID", async () => {
  expect(await run("101")).toEqual({ oldValue: "101" });
  const q = m.execute.mock.calls.map(([s]) => new PgDialect().sqlToQuery(s));
  expect(q[0].params).toEqual([`musicnerd:artist-platform-slot:${artist}:deezer`]);
  expect(q[1].sql).toContain("to_jsonb");
  expect(q[2].sql).toContain("musicnerd_private.disconnect_catalog_link");
  expect(q[2].params).toEqual([
    artist,
    "deezer",
    "101",
    JSON.stringify({ id: "m", platform_id: "101", api_key_hash: "private-original" }),
    actor,
    claim,
    "owner",
  ]);
});
it("rejects missing authenticated user or missing expected ID before a transaction", async () => {
  await expect(disconnectCatalogLink(artist, "deezer", "101")).rejects.toThrow();
  await expect(
    withArtistOperation(artist, { expectedClaimId: claim }, () =>
      disconnectCatalogLink(artist, "deezer", "101"),
    ),
  ).rejects.toThrow();
  await expect(run(undefined)).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("preserves explicit null and never falls back when the function is absent", async () => {
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(Object.assign(new Error("missing function"), { code: "42883" }));
  await expect(run(null)).rejects.toThrow("Catalog disconnect could not be confirmed");
  expect(m.execute).toHaveBeenCalledTimes(3);
});
