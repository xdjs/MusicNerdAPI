import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Copy the explicit source manifest and build inputs only; no node_modules links, generated outputs or environment files. */
export async function packageIsolatedSource(buildRoot, parent) {
  buildRoot = await realpath(buildRoot);
  const files = JSON.parse(await readFile(join(buildRoot, "source-manifest.json"), "utf8"));
  files.push(
    "source-manifest.json",
    "app/page.tsx",
    "app/layout.tsx",
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "next.config.js",
    "verify-build.mjs",
  );
  const root = await realpath(await mkdtemp(join(parent, "mn-about-source-")));
  for (const file of files) {
    if (
      file.startsWith("/") ||
      file.includes("..") ||
      file.includes("node_modules") ||
      file.split("/").some(p => p.startsWith(".env"))
    )
      throw new Error("Unsafe source package entry");
    if ((await realpath(join(buildRoot, file))) !== join(buildRoot, file))
      throw new Error("Source symlink refused");
    await mkdir(dirname(join(root, file)), { recursive: true });
    await cp(join(buildRoot, file), join(root, file), { recursive: false });
  }
  await writeFile(
    join(root, "PACKAGING.md"),
    "Isolated synthetic About project. Install with the pinned package manager and frozen lockfile on the approved host; build script verifies model replacements and route allowlist. Configure only isolated database/Privy credentials after authorization. No credentials or dependencies are bundled in this source package. This is not the full MusicNerdWeb app.\n",
  );
  return { root, files: files.length + 1 };
}
