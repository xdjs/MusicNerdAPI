import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { packageIsolatedSource } from "../packageIsolatedSource.mjs";
it("refuses source symlinks instead of shipping external file references", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mn-source-package-test-"));
  const root = join(parent, "build");
  await mkdir(join(root, "lib"), { recursive: true });
  await writeFile(join(root, "source-manifest.json"), JSON.stringify(["lib/example.ts"]));
  await symlink("/etc/passwd", join(root, "lib/example.ts"));
  try {
    await expect(packageIsolatedSource(root, parent)).rejects.toThrow("Source symlink");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
