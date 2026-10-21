import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
const database = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { getHiddenLinkSourceIds } = await import("@/lib/links/getHiddenLinkSourceIds");

const artist = "00000000-0000-4000-8000-000000000001";
const [hidden, shown, reapproved] = [2, 3, 4].map(n => `00000000-0000-4000-8000-00000000000${n}`);
beforeAll(async () => {
  await client.exec(`create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,source_id uuid,action text,created_at timestamptz);
insert into artist_activity_events(artist_id,source_id,action,created_at) values
 ('${artist}','${hidden}','link_hidden','2026-10-01'),
 ('${artist}','${shown}','link_hidden','2026-10-01'),('${artist}','${shown}','link_shown','2026-10-02'),
 ('${artist}','${reapproved}','link_hidden','2026-10-01'),('${artist}','${reapproved}','source_approved','2026-10-03'),
 ('00000000-0000-4000-8000-000000000099','${shown}','link_hidden','2026-10-05');`);
}, 120_000);
afterAll(() => client.close());

it("the latest visibility decision per source wins", async () => {
  expect(await getHiddenLinkSourceIds(artist)).toEqual([hidden]);
});
