import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

/**
 * Music Nerd's Postgres (Supabase), shared with MusicNerdWeb. The client
 * connects on first query, so importing this never needs the database.
 */
const client = postgres(process.env.SUPABASE_DB_CONNECTION ?? "", {
  prepare: false,
  // Each warm instance shares the finite staging/production pool with MusicNerdWeb.
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type WriteDb = Pick<typeof db, "insert" | "delete" | "execute">;
