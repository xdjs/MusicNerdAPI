import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { findActiveClaim } = await import("@/lib/artistViewer/findActiveClaim");

beforeEach(() => test.client.exec("delete from artist_claims"));
afterAll(() => test.client.close());

describe("findActiveClaim", () => {
  it("returns the pending or approved claim", async () => {
    await test.client.exec(`insert into artist_claims(user_id, artist_id, status) values
      ('${ids.otherUser}', '${ids.artist}', 'rejected'), ('${ids.user}', '${ids.artist}', 'pending');`);
    expect(await findActiveClaim(ids.artist)).toMatchObject({
      userId: ids.user,
      status: "pending",
    });
  });

  it("ignores rejected claims", async () => {
    await test.client.exec(
      `insert into artist_claims(user_id, artist_id, status) values ('${ids.user}', '${ids.artist}', 'rejected');`,
    );
    expect(await findActiveClaim(ids.artist)).toBeUndefined();
  });
});
