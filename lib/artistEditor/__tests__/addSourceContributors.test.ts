import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";
import type { VaultSource } from "@/lib/vault/types";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { addSourceContributors } = await import("@/lib/artistEditor/addSourceContributors");

const e = (n: number) => `20000000-0000-4000-8000-00000000000${n}`;
const emailUser = "00000000-0000-4000-8000-000000000013";
const walletUser = "00000000-0000-4000-8000-000000000014";
beforeAll(async () => {
  await test.client.exec(`
    insert into users(id, username, email, wallet) values
      ('${emailUser}', 'someone@example.com', 'someone@example.com', null),
      ('${walletUser}', '0xDEF', null, '0xdef');
    insert into artist_activity_events(id, artist_id, actor_user_id, actor_kind, action, trigger) values
      ('${e(1)}', '${ids.artist}', '${ids.user}', 'user', 'source_added', 'submission'),
      ('${e(2)}', '${ids.artist}', '${ids.otherUser}', 'user', 'source_added', 'submission'),
      ('${e(3)}', '${ids.artist}', '${emailUser}', 'user', 'source_added', 'upload'),
      ('${e(4)}', '${ids.artist}', '${walletUser}', 'user', 'source_added', 'submission'),
      ('${e(5)}', '${ids.otherArtist}', '${ids.user}', 'user', 'source_added', 'submission'),
      ('${e(6)}', '${ids.artist}', '${ids.user}', 'system', 'source_added', 'research');
  `);
});
afterAll(() => test.client.close());

const source = (id: string, origin: string, activityId: string | null, artistId = ids.artist) =>
  ({ id, origin, activityId, artistId, url: `https://example.com/${id}` }) as VaultSource;

describe("addSourceContributors", () => {
  it("names the user behind a submission or upload", async () => {
    const [named] = await addSourceContributors(ids.artist, [source("a", "submission", e(1))]);
    expect(named).toMatchObject({ id: "a", contributorName: "salsero" });
  });

  it("never names research, hidden users, email or wallet usernames, or another artist's event", async () => {
    const out = await addSourceContributors(ids.artist, [
      source("research", "research", e(1)),
      source("hidden", "submission", e(2)),
      source("email", "upload", e(3)),
      source("wallet", "submission", e(4)),
      source("elsewhere", "submission", e(5)),
      source("system", "submission", e(6)),
      source("none", "submission", null),
    ]);
    expect(out.map(s => s.contributorName)).toEqual([null, null, null, null, null, null, null]);
  });

  it("returns the sources unchanged otherwise, in order", async () => {
    expect(await addSourceContributors(ids.artist, [])).toEqual([]);
    const out = await addSourceContributors(ids.artist, [
      source("x", "research", null),
      source("y", "submission", e(1)),
    ]);
    expect(out.map(s => [s.id, s.url, s.contributorName])).toEqual([
      ["x", "https://example.com/x", null],
      ["y", "https://example.com/y", "salsero"],
    ]);
  });
});
