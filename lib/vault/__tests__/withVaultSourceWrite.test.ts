import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const { scoped, active } = vi.hoisted(() => ({ scoped: vi.fn(), active: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { name: "db" } }));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
vi.mock("@/lib/ownership/getActiveArtistOperation", () => ({ getActiveArtistOperation: active }));
const { withVaultSourceWrite } = await import("@/lib/vault/withVaultSourceWrite");

const render = (p: unknown) => new PgDialect().sqlToQuery(p as never);

beforeEach(() => {
  scoped.mockReset().mockImplementation(async (_a, write) => write({ name: "tx" }));
  active.mockReset();
});

describe("withVaultSourceWrite", () => {
  it("writes with the plain client and the id alone outside an operation", async () => {
    active.mockReturnValue(undefined);
    const write = vi.fn(async (..._a: unknown[]) => "ok");
    expect(await withVaultSourceWrite("s1", write)).toBe("ok");
    expect(write.mock.calls[0][0]).toEqual({ name: "db" });
    expect(render(write.mock.calls[0][1]).params).toEqual(["s1"]);
    expect(scoped).not.toHaveBeenCalled();
  });

  it("inside an operation, re-checks the claim and only touches that artist's source", async () => {
    active.mockReturnValue({ artistId: "a1", expectedClaimId: "c1" });
    const write = vi.fn(async (..._a: unknown[]) => "ok");
    await withVaultSourceWrite("s1", write);
    expect(scoped).toHaveBeenCalledWith("a1", expect.any(Function));
    expect(write.mock.calls[0][0]).toEqual({ name: "tx" });
    const { sql, params } = render(write.mock.calls[0][1]);
    expect(sql).toContain('"artist_id"');
    expect(params).toEqual(["s1", "a1"]);
  });
});
