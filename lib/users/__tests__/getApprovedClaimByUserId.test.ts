import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { getApprovedClaimByUserId } = await import("@/lib/users/getApprovedClaimByUserId");

const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const artist = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(async () => {
  await client.exec("delete from artist_claims");
});
afterAll(async () => client.close());

describe("getApprovedClaimByUserId", () => {
  it("returns the user's approved claim", async () => {
    await client.query(
      "insert into artist_claims(user_id, artist_id, status) values($1, $2, 'approved')",
      [me, artist],
    );
    expect(await getApprovedClaimByUserId(me)).toMatchObject({ userId: me, artistId: artist });
  });

  it("ignores pending and rejected claims and other users' claims", async () => {
    await client.query(
      "insert into artist_claims(user_id, artist_id, status) values($1, $2, 'pending'), ($1, $2, 'rejected'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $2, 'approved')",
      [me, artist],
    );
    expect(await getApprovedClaimByUserId(me)).toBeUndefined();
  });

  it("is undefined when the database fails, never throws", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    await client.exec("alter table artist_claims rename to artist_claims_gone");
    try {
      expect(await getApprovedClaimByUserId(me)).toBeUndefined();
    } finally {
      await client.exec("alter table artist_claims_gone rename to artist_claims");
    }
  });
});
