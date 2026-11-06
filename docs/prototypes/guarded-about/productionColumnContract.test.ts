import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildFullArtistProjection } from "./buildFullArtistProjection";
import production from "./productionArtistColumns.json";
import { buildProductionMapCutover } from "./buildProductionMapCutover";
const base = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
const roles = { reader: null, mapEditor: "webmapdata_editor", publicReaders: false };
it("pins the observed production order without adding fields or changing types", () => {
  const sql = buildFullArtistProjection(base, roles, production.columns);
  expect(sql).toContain(JSON.stringify(production.columns));
  expect(sql.indexOf('a."webmapdata",a."node_pfp",a."custom_image"')).toBeGreaterThan(0);
});
it("refuses an arbitrary field, type change or duplicate in a target order", () => {
  for (const change of [
    [...production.columns, { name: "secret", type: "text" }],
    production.columns.map((c, i) => (i === 0 ? { ...c, type: "text" } : c)),
    production.columns.map((c, i) => (i === 0 ? production.columns[1] : c)),
  ])
    expect(() => buildFullArtistProjection(base, roles, change)).toThrow(
      "Reviewed column permutation required",
    );
});

it("keeps the reviewable SQL identical to the tested generator", () => {
  const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
  expect(read("./productionMapCutover.sql")).toBe(
    buildProductionMapCutover(
      base,
      read("./productionMapOperatorPreflight.sql"),
      read("./productionMapPostflight.sql"),
    ),
  );
});
