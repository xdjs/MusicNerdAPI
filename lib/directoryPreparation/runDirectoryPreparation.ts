import { selectOfficialAbout } from "./selectOfficialAbout";
import { preparePublicAbout } from "./preparePublicAbout";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { saveJobProgress } from "@/lib/research/saveJobProgress";
import type { ResearchJob, SliceOutcome } from "@/lib/research/types";
import { loadDirectoryMaterial } from "./loadDirectoryMaterial";
import { generateDirectoryDraft } from "./generateDirectoryDraft";
/** Generate outside locks, then commit only under the unchanged creation, source and job generation. */
export async function runDirectoryPreparation(
  job: ResearchJob,
  deadline: number,
): Promise<SliceOutcome> {
  if (deadline - Date.now() < 32_000) {
    await saveJobProgress(job.id, job.cursor);
    return { progress: "Waiting for a private preparation slice", done: false, waiting: true };
  }
  if (
    !job.activityId ||
    job.state.creationActivityId !== job.activityId ||
    job.state.claimId !== null ||
    job.state.purpose !== "directory_preparation"
  )
    throw new Error("Invalid private preparation authority");
  return withArtistOperation(
    job.artistId,
    {
      expectedClaimId: null,
      trigger: "directory_add",
      activityId: job.activityId,
      sourceOrigin: "research",
    },
    async () => {
      const material = await db.transaction(async tx => {
        await lockScopedArtistWrite(tx, job.artistId);
        return loadDirectoryMaterial(tx, job.artistId, job.activityId!);
      });
      const draft = await generateDirectoryDraft(material);
      const publicAbout =
        draft.status === "ready"
          ? ((await selectOfficialAbout(material)) ?? preparePublicAbout(material, draft))
          : null;
      const committed = await db.transaction(async tx => {
        await lockScopedArtistWrite(tx, job.artistId);
        const lease = rowsOf(
          await tx.execute(
            sql`select id from artist_research_jobs where id=${job.id}::uuid and status='running' and attempts=${job.attempts} and updated_at=${job.updatedAt}::timestamptz for update`,
          ),
        );
        if (!lease.length) return false;
        const current = await loadDirectoryMaterial(tx, job.artistId, job.activityId!);
        if (JSON.stringify(current) !== JSON.stringify(material))
          throw new Error("Private preparation inputs changed");
        await tx.execute(sql`insert into artist_directory_preparations(artist_id,activity_id,job_id,status,document,about,starting_bio,manifest,public_about)
    values(${job.artistId}::uuid,${job.activityId}::uuid,${job.id}::uuid,${draft.status},${draft.document},${draft.about},${material.startingBio},${JSON.stringify(material.manifest)}::jsonb,${publicAbout ? JSON.stringify(publicAbout) : null}::jsonb)
    on conflict(artist_id) do update set activity_id=excluded.activity_id,job_id=excluded.job_id,status=excluded.status,document=excluded.document,about=excluded.about,starting_bio=excluded.starting_bio,manifest=excluded.manifest,public_about=excluded.public_about,updated_at=now()
    where artist_directory_preparations.public_about->>'editedByAdmin' is distinct from 'true'`);
        await tx.execute(
          sql`update artist_research_jobs set status='done',claimed_at=null,last_error=null,updated_at=now() where id=${job.id}::uuid`,
        );
        return true;
      });
      return committed
        ? {
            progress:
              draft.status === "ready"
                ? "Private draft prepared for artist review"
                : "No identity-verified readable originals ready",
            done: true,
          }
        : { progress: "Private preparation lease changed", done: false, waiting: true };
    },
  );
}
