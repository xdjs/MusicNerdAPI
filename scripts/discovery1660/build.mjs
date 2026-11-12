import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("braintrust"))("esbuild");
await build({
  entryPoints: ["scripts/discovery1660/run.ts"],
  outfile: ".next/discovery1660.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [
    {
      name: "next-node",
      setup(b) {
        b.onResolve({ filter: /^next\/(server|headers|cache)$/ }, a => ({
          path: require.resolve(a.path),
          external: true,
        }));
      },
    },
  ],
});
