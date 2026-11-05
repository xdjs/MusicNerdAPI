import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { POST } = await import("@/app/api/findTwitterHandle/route");
const database = new PGlite({ extensions: { pg_trgm } });
const dialect = new PgDialect();

beforeAll(async () => {
  await database.exec(
    "CREATE EXTENSION pg_trgm; CREATE TABLE artists (name text, lcname text, x text)",
  );
}, 20_000);
afterAll(() => database.close());
beforeEach(async () => {
  await database.exec("TRUNCATE artists");
  execute.mockImplementation(async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query);
    return (await database.query(compiled.sql, compiled.params)).rows;
  });
});
const add = (name: string, x: string | null) =>
  database.query("INSERT INTO artists VALUES ($1, $2, $3)", [name, normaliseArtistName(name), x]);
const lookup = async (name: string) => {
  const response = await POST(
    new Request("https://api.test/api/findTwitterHandle", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  return response.json();
};

it("keeps White Magic's null instead of a near-name artist's handle", async () => {
  await add("White Magic Band", "other_artist");
  await add("White Magic", null);
  expect(await lookup("White Magic")).toEqual({ result: null });
});
it("does not select a substring or similar name when no exact artist exists", async () => {
  await add("White Magic Band", "other_artist");
  expect(await lookup("White Magic")).toEqual({});
});
it.each([
  ["first", "second"],
  [null, "second"],
  ["same", "same"],
])("refuses ambiguous exact names even with handles %s and %s", async (first, second) => {
  await add("White Magic", first);
  await add("white magic", second);
  expect(await lookup("White Magic")).toEqual({});
});
it("ignores case and outer spaces for a unique match", async () => {
  await add("  White Magic  ", "white_magic");
  expect(await lookup(" WHITE MAGIC ")).toEqual({ result: "white_magic" });
});
it.each(["WhiteMagic", "White  Magic", "White-Magic", "Whíte Magic"])(
  "does not conflate %s with White Magic",
  async name => {
    await add(name, "other_artist");
    expect(await lookup("White Magic")).toEqual({});
  },
);
it.each(["%", "_", "' OR TRUE --", "   "])(
  "does not interpret %s as a search pattern",
  async name => {
    await add("White Magic", "white_magic");
    expect(await lookup(name)).toEqual({});
  },
);
it("supports literal punctuation in an exact name", async () => {
  await add("100%_Magic", "literal_artist");
  expect(await lookup("100%_Magic")).toEqual({ result: "literal_artist" });
});
it("returns an error when the actual database read fails", async () => {
  execute.mockRejectedValueOnce(new Error("unavailable"));
  const response = await POST(
    new Request("https://api.test/api/findTwitterHandle", {
      method: "POST",
      body: JSON.stringify({ name: "White Magic" }),
    }),
  );
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("Something went wrong on our end");
});
