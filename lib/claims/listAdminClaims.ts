import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/** One claim on the admin page, with its artist and claimant. */
export type AdminClaim = {
  id: string;
  status: "pending" | "approved" | "rejected";
  referenceCode: string | null;
  artistId: string;
  artistName: string | null;
  artistInstagram: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
};

/**
 * Up to 200 artist claims for the admin page: pending first, then approved,
 * then the rest, newest first in each. MusicNerdWeb's `getAllClaims`, joined
 * here in SQL because the API's schema doesn't declare the claim's reference
 * code or creation time.
 *
 * @returns The claims.
 */
export async function listAdminClaims(): Promise<AdminClaim[]> {
  const rows = await db.execute(sql`
    select c.id, c.status, c.reference_code as "referenceCode", c.artist_id as "artistId",
      a.name as "artistName", a.instagram as "artistInstagram", c.user_id as "userId",
      u.username as "userName", u.email as "userEmail", c.created_at::text as "createdAt"
    from artist_claims c
    left join artists a on a.id = c.artist_id
    left join users u on u.id = c.user_id
    order by case when c.status = 'pending' then 0 when c.status = 'approved' then 1 else 2 end,
      c.created_at desc
    limit 200`);
  return rowsOf(rows) as AdminClaim[];
}
