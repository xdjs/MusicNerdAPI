import type { db } from "@/lib/db/db";

/** The open transaction the account merge runs in. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
