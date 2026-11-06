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
    expect(config).not.toContain(resolve("."));
    const tsconfig = JSON.parse(await readFile(join(root, "tsconfig.json"), "utf8"));
    expect(tsconfig.compilerOptions.paths["@/lib/lore/generateAboutFromDoc"]).toEqual([
      "./docs/prototypes/hosted-about/generateAboutFromDoc.ts",
    ]);
    const manifest = JSON.parse(
      await readFile(join(root, "source-manifest.json"), "utf8"),
    ) as string[];
    expect(manifest).toContain("lib/auth/verifyPrivyAccessToken.ts");
    expect(
      manifest.every(
        name => name.endsWith(".ts") && !name.includes("__tests__") && !name.includes(".."),
      ),
    ).toBe(true);
    const page = await readFile(join(root, "app/page.tsx"), "utf8");
    expect(page).toContain('credentials: "same-origin"');
    expect(page).not.toMatch(/localStorage|sessionStorage|useEffect|console\./);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
