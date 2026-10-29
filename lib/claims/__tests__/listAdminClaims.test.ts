import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { listAdminClaims } = await import("@/lib/claims/listAdminClaims");

beforeAll(async () => {
  await test.client
    .exec(`insert into artist_claims(id, user_id, artist_id, status, reference_code, created_at) values
    ('10000000-0000-4000-8000-000000000001', '${ids.user}', '${ids.artist}', 'rejected', 'MN-OLD1', '2026-10-27T00:00:00Z'),
    ('10000000-0000-4000-8000-000000000002', '${ids.user}', '${ids.artist}', 'approved', 'MN-APPR', '2026-10-25T00:00:00Z'),
    ('10000000-0000-4000-8000-000000000003', '${ids.otherUser}', '${ids.otherArtist}', 'pending', null, '2026-10-20T00:00:00Z'),
    ('10000000-0000-4000-8000-000000000004', '${ids.user}', '${ids.otherArtist}', 'pending', 'MN-NEW1', '2026-10-28T00:00:00Z');`);
});
afterAll(() => test.client.close());

describe("listAdminClaims", () => {
  it("lists pending first, then approved, then rejected, newest first in each", async () => {
    const claims = await listAdminClaims();
    expect(claims.map(c => c.referenceCode)).toEqual(["MN-NEW1", null, "MN-APPR", "MN-OLD1"]);
  });

  it("carries the artist and the claimant", async () => {
    const [, , approved] = await listAdminClaims();
    expect(approved).toEqual({
      id: "10000000-0000-4000-8000-000000000002",
      status: "approved",
      referenceCode: "MN-APPR",
      artistId: ids.artist,
      artistName: "Bio Ritmo",
      artistInstagram: "bioritmo",
      userId: ids.user,
      userName: "salsero",
      userEmail: "fan@example.com",
      createdAt: expect.stringContaining("2026-10-25"),
    });
  });

  it("returns at most 200", async () => {
    await test.client.exec(`insert into artist_claims(user_id, artist_id, status)
      select '${ids.user}', '${ids.artist}', 'rejected' from generate_series(1, 210);`);
    expect(await listAdminClaims()).toHaveLength(200);
  });
});
