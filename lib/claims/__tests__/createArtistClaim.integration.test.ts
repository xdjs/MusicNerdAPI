import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { createArtistClaim } from "../createArtistClaim";

vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeAll(async () => {
  await client.exec(`
    CREATE TYPE claim_status AS ENUM ('pending','approved','rejected');
    CREATE TABLE artists (id uuid PRIMARY KEY);
    CREATE TABLE artist_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
      artist_id uuid NOT NULL, status claim_status NOT NULL DEFAULT 'pending', reference_code text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX artist_claims_artist_id_active_uniq ON artist_claims (artist_id) WHERE status IN ('pending','approved');
  `);
}, 30000);
beforeEach(async () => {
  await client.exec("DELETE FROM artist_claims; DELETE FROM artists;");
  await client.query("INSERT INTO artists (id) VALUES ($1)", [artistId]);
});
afterAll(async () => client.close());

it("files a pending claim with a reference code", async () => {
  const result = await createArtistClaim(userId, artistId);
  expect(result).toEqual({ referenceCode: expect.stringMatching(/^MN-/) });
  const { rows } = await client.query<{ status: string; reference_code: string; user_id: string }>(
    "SELECT status, reference_code, user_id FROM artist_claims",
  );
  expect(rows).toEqual([
    {
      status: "pending",
      reference_code: (result as { referenceCode: string }).referenceCode,
      user_id: userId,
    },
  ]);
});

it("is claimed while a pending or approved claim exists", async () => {
  await client.query(
    "INSERT INTO artist_claims (user_id, artist_id, status) VALUES ($1,$2,'approved')",
    [userId, artistId],
  );
  expect(await createArtistClaim(userId, artistId)).toBe("claimed");
});

it("lets a rejected claim be claimed again", async () => {
  await client.query(
    "INSERT INTO artist_claims (user_id, artist_id, status) VALUES ($1,$2,'rejected')",
    [userId, artistId],
  );
  expect(await createArtistClaim(userId, artistId)).toEqual({ referenceCode: expect.any(String) });
});

it("is no_artist for an unknown artist", async () => {
  expect(await createArtistClaim(userId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBe("no_artist");
});
