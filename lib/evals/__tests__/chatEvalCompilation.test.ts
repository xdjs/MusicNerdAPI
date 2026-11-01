import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("braintrust"));
const { build } = sdkRequire("esbuild") as {
  build(options: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }>;
};

afterEach(() => vi.unstubAllGlobals());

it("compiles the actual eval entry with the pinned CLI CommonJS contract without executing it", async () => {
  const network = vi.fn(() => {
    throw new Error("network_forbidden");
  });
  vi.stubGlobal("fetch", network);
  const cli = readFileSync(join(dirname(require.resolve("braintrust")), "cli.js"), "utf8");
  expect(cli).toContain('platform: "node"');
  // Compile local imports with the CLI output contract; dependencies stay external.
  // No output is written, imported, evaluated or passed to the Braintrust runner.
  const result = await build({
    entryPoints: ["evals/chat.eval.ts"],
    bundle: true,
    treeShaking: true,
    platform: "node",
    target: "node24",
    write: false,
    packages: "external",
    external: ["next"],
    logLevel: "silent",
  });
  expect(result.outputFiles[0].text).toContain("chat-single");
  expect(network).not.toHaveBeenCalled();
});
