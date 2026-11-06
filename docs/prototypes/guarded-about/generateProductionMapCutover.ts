/** Local SQL generation only. Never connects to a database. Run from repository root. */
import { readFileSync, writeFileSync } from "node:fs";
import { buildProductionMapCutover } from "./buildProductionMapCutover";
const directory = "docs/prototypes/guarded-about/";
const read = (name: string) => readFileSync(directory + name, "utf8");
writeFileSync(
  directory + "productionMapCutover.sql",
  buildProductionMapCutover(
    read("productionMapOperatorPreflight.sql"),
    read("productionMapPostflight.sql"),
  ),
);
