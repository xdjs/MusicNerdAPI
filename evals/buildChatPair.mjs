import { createRequire } from "node:module";
// Reuse the locked Braintrust CLI bundler; no new dependency or install.
const require = createRequire(import.meta.resolve("braintrust"));
const { build } = require("esbuild");
await build({
  entryPoints: ["evals/chat-pair.ts"],
  outfile: ".next/chat-pair.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  external: ["next", "next/*"],
  tsconfig: "tsconfig.json",
  logLevel: "error",
});
