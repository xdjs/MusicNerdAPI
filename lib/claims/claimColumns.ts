import { sql } from "drizzle-orm";

/**
 * The claim columns the claim routes return, as camelCase. The Drizzle schema
 * declares only the columns other routes read, so these are selected by name.
 */
export const claimColumns = sql.raw(
  `id, user_id as "userId", artist_id as "artistId", status, reference_code as "referenceCode"`,
);
