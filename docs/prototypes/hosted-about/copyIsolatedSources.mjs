import { copyFile, mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

/** Copy only the route's static TS source closure plus named test adapters; no env, fixtures or arbitrary assets. */
export async function copyIsolatedSources(sourceRoot, targetRoot) {
  const require = createRequire(join(sourceRoot, "package.json"));
  const ts = require("typescript");
  const adapters = [
    "runtime",
    "createHostedAboutAdapter",
    "denyProvider",
    "synthesizeArtistDoc",
    "generateAboutFromDoc",
    "generateLoreSummary",
    "generateText",
    "streamText",
    "generateObject",
    "generateArray",
  ];
  const pending = [
    "app/api/artistBio/[id]/route.ts",
    ...adapters.map(name => `docs/prototypes/hosted-about/${name}.ts`),
  ];
  const copied = new Set();
  const options = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: sourceRoot,
    paths: { "@/*": ["./*"] },
    allowJs: true,
  };
  while (pending.length) {
    const name = pending.pop();
    if (copied.has(name)) continue;
    if (
      !(
        name === "app/api/artistBio/[id]/route.ts" ||
        name.startsWith("lib/") ||
        adapters.some(a => name === `docs/prototypes/hosted-about/${a}.ts`)
      ) ||
      !name.endsWith(".ts") ||
      name.includes("/__tests__/")
    )
      throw new Error(`Source outside allowlist: ${name}`);
    const source = join(sourceRoot, name);
    if ((await realpath(source)) !== source) throw new Error(`Source symlink refused: ${name}`);
    const text = await readFile(source, "utf8");
    await mkdir(dirname(join(targetRoot, name)), { recursive: true });
    await copyFile(source, join(targetRoot, name));
    copied.add(name);
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      const specifier = imported.fileName;
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
      const result = ts.resolveModuleName(specifier, source, options, ts.sys).resolvedModule;
      if (!result) throw new Error(`Unresolved local import: ${name}: ${specifier}`);
      const file = relative(sourceRoot, resolve(result.resolvedFileName));
      if (file.startsWith("..") || file.startsWith("/"))
        throw new Error(`External local source: ${specifier}`);
      pending.push(file);
    }
  }
  return [...copied].sort();
}
