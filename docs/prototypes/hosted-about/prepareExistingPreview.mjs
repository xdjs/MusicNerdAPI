import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createIsolatedArtifact } from "./createIsolatedArtifact.mjs";

/** Prepare local source only; never links, uploads, deploys or edits project configuration. */
export async function prepareExistingPreview(sourceRoot, parent, artistId) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(artistId))
    throw new Error("Invalid synthetic artist");
  const root = await createIsolatedArtifact(sourceRoot, parent);
  const route = "app/api/artistBio/[id]/route.ts";
  const actual = "app/api/artistBio/[id]/actualRoute.ts";
  const guard = "docs/prototypes/hosted-about/createExistingPreviewHandler.ts";
  await rename(join(root, route), join(root, actual));
  await copyFile(join(sourceRoot, guard), join(root, guard));
  await writeFile(
    join(root, route),
    `import { createExistingPreviewHandler } from "@/docs/prototypes/hosted-about/createExistingPreviewHandler";
export const maxDuration = 60;
const artistId = ${JSON.stringify(artistId)};
export const GET = createExistingPreviewHandler(artistId, process.env, async () => (await import("./actualRoute")).GET);
export const PUT = createExistingPreviewHandler(artistId, process.env, async () => (await import("./actualRoute")).PUT);
export async function OPTIONS() { return new Response(null, {status:204}); }
`,
  );
  const manifest = JSON.parse(await readFile(join(root, "source-manifest.json"), "utf8"));
  manifest.push(actual, guard);
  await writeFile(join(root, "source-manifest.json"), JSON.stringify(manifest.sort(), null, 2));
  await writeFile(
    join(root, "PREVIEW-FIXTURE.md"),
    `Synthetic artist: ${artistId}\nNo record has been created. Requires approved fixture identity, migration and credential isolation.\n`,
  );
  return { root, artistId };
}
