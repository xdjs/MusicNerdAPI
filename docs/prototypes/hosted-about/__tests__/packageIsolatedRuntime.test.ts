import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { packageIsolatedRuntime } from "../packageIsolatedRuntime.mjs";
it("refuses an unexpected external symlink before copying runtime dependencies", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mn-package-test-"));
  const build = join(parent, "build");
  await mkdir(join(build, ".next/standalone/build"), { recursive: true });
  await writeFile(join(build, ".next/standalone/build/server.js"), "");
  await symlink("/etc", join(build, ".next/standalone/escape"));
  try {
    await expect(packageIsolatedRuntime(build, parent)).rejects.toThrow("External symlink");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
