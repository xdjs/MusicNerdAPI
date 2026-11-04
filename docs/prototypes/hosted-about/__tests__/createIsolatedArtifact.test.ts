import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { createIsolatedArtifact } from "../createIsolatedArtifact.mjs";
it("creates only the real About route and explicit isolated config without copying secrets", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mn-artifact-test-"));
  try {
    const root = await createIsolatedArtifact(resolve("."), parent);
    expect(await readdir(join(root, "app/api"))).toEqual(["artistBio"]);
    expect(await readFile(join(root, "app/api/artistBio/[id]/route.ts"), "utf8")).toBe(
      await readFile("app/api/artistBio/[id]/route.ts", "utf8"),
    );
    expect((await readdir(root)).some(name => name.startsWith(".env"))).toBe(false);
    const config = await readFile(join(root, "next.config.js"), "utf8");
    expect(config).toContain("synthesizeArtistDoc$");
    expect(config).toContain("module-audit.json");
    expect(config).not.toContain("ignoreBuildErrors");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
