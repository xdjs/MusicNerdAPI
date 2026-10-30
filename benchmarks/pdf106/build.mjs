import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const braintrustRequire = createRequire(require.resolve("braintrust"));
const { build } = braintrustRequire("esbuild");
const realAi = require.resolve("ai");
await build({
  entryPoints: [process.argv[2] ?? "benchmarks/pdf106/run.ts"],
  outfile: ".next/pdf106-run.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [
    {
      name: "observe-real-sdk",
      setup(b) {
        b.onResolve({ filter: /^next\/(server|headers|cache)$/ }, args => ({
          path: require.resolve(args.path),
          external: true,
        }));
        b.onResolve({ filter: /^ai$/ }, () => ({ path: "observer", namespace: "pdf106" }));
        b.onResolve({ filter: /^pdf106-real-ai$/ }, () => ({ path: realAi, external: true }));
        b.onLoad({ filter: /.*/, namespace: "pdf106" }, () => ({
          loader: "js",
          contents: `export * from 'pdf106-real-ai'; import {streamText as original} from 'pdf106-real-ai'; export function streamText(options) { const result = original(options); globalThis.pdf106Observe?.(result); return result; }`,
        }));
      },
    },
  ],
});
