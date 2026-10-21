import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, ids } from "./testDb";

const test = await createTestDb();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.database;
  },
}));
const { countUserUgc } = await import("@/lib/contributions/countUserUgc");

beforeAll(async () => {
  await test.client.exec(`
insert into ugcresearch(artist_id,accepted,user_id) values
 ('${ids.artist}',true,'${ids.user}'),
 ('${ids.artist}',true,'${ids.user}'),
 ('${ids.artist}',false,'${ids.user}'),
 ('${ids.artist}',null,'${ids.user}'),
 ('${ids.artist}',true,'${ids.otherUser}');`);
});
afterAll(async () => test.client.close());

describe("countUserUgc", () => {
  it("counts the user's submissions, all or only the approved ones, as a number", async () => {
    expect(await countUserUgc(ids.user, false)).toBe(4);
    expect(await countUserUgc(ids.user, true)).toBe(2);
    expect(await countUserUgc("00000000-0000-4000-8000-0000000000ff", false)).toBe(0);
  });
});
