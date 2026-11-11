import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { prepareExistingPreview } from "../prepareExistingPreview.mjs";
it("preserves the actual route and installs fixed-fixture lazy guards only in generated output", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mn-preview-test-"));
  try {
    const id = "00000000-0000-4000-8000-000000000001";
    const { root } = await prepareExistingPreview(resolve("."), parent, id);
    expect(await readFile(join(root, "app/api/artistBio/[id]/actualRoute.ts"), "utf8")).toBe(
      await readFile("app/api/artistBio/[id]/route.ts", "utf8"),
    );
    const wrapper = await readFile(join(root, "app/api/artistBio/[id]/route.ts"), "utf8");
    expect(wrapper).toContain(id);
    expect(wrapper).toContain('await import("./actualRoute")');
    expect(wrapper).not.toContain('from "./actualRoute"');
    const manifest = JSON.parse(await readFile(join(root, "source-manifest.json"), "utf8"));
    expect(manifest).toContain("docs/prototypes/hosted-about/createExistingPreviewHandler.ts");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
