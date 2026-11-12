import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { verifyIsolatedBuild } from "../verifyIsolatedBuild.mjs";
it("refuses an empty audit or an unexpected API route", async () => {
  const root = await mkdtemp(join(tmpdir(), "mn-audit-test-"));
  try {
    await mkdir(join(root, ".next/server"), { recursive: true });
    await writeFile(join(root, ".next/module-audit.json"), "[]");
    await writeFile(
      join(root, ".next/server/app-paths-manifest.json"),
      JSON.stringify({ "/api/artistBio/[id]/route": "route.js" }),
    );
    await expect(verifyIsolatedBuild(root, "/synthetic/source")).rejects.toThrow("Missing adapter");
    await writeFile(
      join(root, ".next/module-audit.json"),
      JSON.stringify(
        ["synthesizeArtistDoc", "generateAboutFromDoc", "generateLoreSummary"]
          .map(n => `/synthetic/source/docs/prototypes/hosted-about/${n}.ts`)
          .concat(["/synthetic/source/lib/auth/verifyPrivyAccessToken.ts"]),
      ),
    );
    await writeFile(
      join(root, ".next/server/app-paths-manifest.json"),
      JSON.stringify({ "/api/artistBio/[id]/route": "route.js", "/api/admin/route": "admin.js" }),
    );
    await expect(verifyIsolatedBuild(root, "/synthetic/source")).rejects.toThrow(
      "Unexpected route",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
