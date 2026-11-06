import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildProductionMapCutover } from "./buildProductionMapCutover";
const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
const stage = () =>
  buildProductionMapCutover(
    read("./productionMapOperatorPreflight.sql"),
    read("./productionMapPostflight.sql"),
  );
it("keeps the reviewable access-only SQL identical to its generator", () => {
  expect(read("./productionMapCutover.sql")).toBe(stage());
});
it("installs no projection objects, policies, membership or replacement grants", () => {
  expect(stage()).not.toMatch(/^\s*(?:CREATE|ALTER|DROP|GRANT)\s/im);
  expect(stage()).not.toContain("mn_projection_reader");
  expect(stage()).not.toContain("mn_public");
  expect(stage()).not.toContain("projection.sql");
});
it("requires an outer transaction and explicit raw-read retirement", () => {
  const sql = stage();
  expect(sql).toContain("SAVEPOINT mn_about_access_cutover;");
  expect(sql).not.toMatch(/^COMMIT;/m);
  expect(sql).toContain("REVOKE SELECT ON public.artists FROM PUBLIC,anon,authenticated;");
  expect(sql).toContain("REVOKE SELECT ON public.artists FROM webmapdata_editor;");
  expect(sql).toContain("Unexpected public raw access; explicit grant review required");
  expect(sql).toContain("Unexpected managed CLI role attributes or membership");
});
