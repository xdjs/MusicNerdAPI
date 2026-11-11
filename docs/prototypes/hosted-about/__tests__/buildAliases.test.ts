import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { buildAliases } from "../buildAliases";
import { generateText } from "../generateText";
import { streamText } from "../streamText";
import { generateObject } from "../generateObject";
import { generateArray } from "../generateArray";
it("provides explicit model-only aliases, leaving auth, routes and database untouched", async () => {
  const aliases = buildAliases();
  expect(Object.keys(aliases)).toEqual([
    "@/lib/lore/synthesizeArtistDoc",
    "@/lib/lore/generateAboutFromDoc",
    "@/lib/lore/generateLoreSummary",
    "@/lib/ai/generateText",
    "@/lib/ai/streamText",
    "@/lib/ai/generateObject",
    "@/lib/ai/generateArray",
  ]);
  for (const path of Object.values(aliases)) expect(await readFile(path, "utf8")).toBeTruthy();
  const productionConfig = await readFile(
    new URL("../../../../next.config.ts", import.meta.url),
    "utf8",
  );
  expect(productionConfig).not.toContain("hosted-about");
});
it("denies unexpected AI entry points without a request or environment override", () => {
  for (const call of [generateText, streamText, generateObject, generateArray])
    expect(() => call()).toThrow("Provider calls are forbidden");
});
