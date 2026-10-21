import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { getArtistSummaries } = await import("@/lib/profile/getArtistSummaries");

const claimed = "11111111-1111-4111-8111-111111111111";
const unclaimed = "22222222-2222-4222-8222-222222222222";
const nudge = "33333333-3333-4333-8333-333333333333";
const pending = "44444444-4444-4444-8444-444444444444";
const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(async () => {
  await client.exec("delete from artists; delete from artist_claims");
  await client.query(
    "insert into artists(id, name, bio) values($1, 'Claimed', 'A real About.'), ($2, 'Unclaimed', 'Hidden About.'), ($3, 'Nudge', $5), ($4, 'Pending', 'Pending About.')",
    [claimed, unclaimed, nudge, pending, ABOUT_EMPTY_STATE],
  );
  await client.query(
    "insert into artist_claims(user_id, artist_id, status) values($1, $2, 'approved'), ($1, $3, 'approved'), ($1, $4, 'pending')",
    [me, claimed, nudge, pending],
  );
});
afterAll(async () => client.close());

describe("getArtistSummaries", () => {
  it("returns the About only for artists with an approved claim and a real About", async () => {
    const rows = await getArtistSummaries([claimed, unclaimed, nudge, pending]);
    expect(rows).toHaveLength(4);
    expect(Object.fromEntries(rows.map(r => [r.id, r.bio]))).toEqual({
      [claimed]: "A real About.",
      [unclaimed]: null,
      [nudge]: null,
      [pending]: null,
    });
  });

  it("skips unknown ids", async () => {
    expect(await getArtistSummaries(["99999999-9999-4999-8999-999999999999"])).toEqual([]);
  });
});
