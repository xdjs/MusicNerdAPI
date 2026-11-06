import { createRequire } from "node:module";
// Reuse the locked Braintrust CLI bundler; no new dependency or install.
const require = createRequire(import.meta.resolve("braintrust"));
const { build } = require("esbuild");
await build({
  entryPoints: ["evals/chat-single-preflight.ts"],
  outfile: ".next/chat-single-preflight.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  external: ["next", "next/*"],
  tsconfig: "tsconfig.json",
  logLevel: "error",
});
