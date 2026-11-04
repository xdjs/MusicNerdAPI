import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";

/** Fail closed unless the isolated build retained real auth, replaced models, and emitted only the allowed route. */
export async function verifyIsolatedBuild(root, sourceRoot) {
  // Synthetic unit fixtures need not have a source tree on disk.
  sourceRoot = await realpath(sourceRoot).catch(() => sourceRoot);
  const modules = JSON.parse(await readFile(join(root, ".next/module-audit.json"), "utf8"));
  for (const name of ["synthesizeArtistDoc", "generateAboutFromDoc", "generateLoreSummary"]) {
    if (!modules.includes(join(sourceRoot, `docs/prototypes/hosted-about/${name}.ts`)))
      throw new Error(`Missing adapter: ${name}`);
    if (modules.includes(join(sourceRoot, `lib/lore/${name}.ts`)))
      throw new Error(`Original model module: ${name}`);
  }
  if (!modules.includes(join(sourceRoot, "lib/auth/verifyPrivyAccessToken.ts")))
    throw new Error("Real token verifier missing");
  for (const module of modules) {
    if (
      /\/lib\/ai\/(generateText|streamText|generateObject|generateArray)\.ts$/.test(module) ||
      /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:ai\/|@ai-sdk\/)/.test(module)
    )
      throw new Error(`Provider module present: ${module}`);
  }
  const paths = JSON.parse(
    await readFile(join(root, ".next/server/app-paths-manifest.json"), "utf8"),
  );
  const allowed = new Set([
    "/api/artistBio/[id]/route",
    "/_not-found/page",
    "/_global-error/page",
    "/page",
  ]);
  for (const route of Object.keys(paths))
    if (!allowed.has(route)) throw new Error(`Unexpected route: ${route}`);
  if (!paths["/api/artistBio/[id]/route"]) throw new Error("About route missing");
  return {
    moduleCount: modules.length,
    routes: Object.keys(paths).sort(),
    realAuth: true,
    modelAdapters: 3,
  };
}
