import { db } from "@/lib/db/db";
import type { ResearchJob } from "@/lib/research/types";
import type { ExtractionState } from "@/lib/sourceExtraction/types";
import { lockSourceExtractionSlice } from "@/lib/sourceExtraction/lockSourceExtractionSlice";

/** Authorize a fetch with a short transaction; never hold a database lock across HTTP. */
export async function checkSourceExtractionSlice(job: ResearchJob, state: ExtractionState) {
  return db.transaction(tx => lockSourceExtractionSlice(tx, job, state));
}
