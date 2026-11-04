import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyIsolatedBuild } from "./verifyIsolatedBuild.mjs";
import { createIsolatedArtifact } from "./createIsolatedArtifact.mjs";

/** Build only the disposable artifact with a fresh environment and denied Node network transports. */
export async function runOfflineBuild(sourceRoot) {
  const root = await createIsolatedArtifact(resolve(sourceRoot), tmpdir());
  await mkdir(join(root, "home"));
  await mkdir(join(root, "tmp"));
  const preload = fileURLToPath(new URL("./deny-network.cjs", import.meta.url));
  const audit = join(root, "network-attempts.log");
  await writeFile(audit, "");
  const env = {
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: join(root, "home"),
    TMPDIR: join(root, "tmp"),
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
    NODE_OPTIONS: `--require=${preload}`,
    SYNTHETIC_NETWORK_AUDIT: audit,
  };
  const child = spawn(
    process.execPath,
    [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", chunk => {
      log += chunk;
      process.stdout.write(chunk);
    });
  const timer = setTimeout(() => child.kill("SIGTERM"), 120000);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", resolve);
    });
  } finally {
    clearTimeout(timer);
    await writeFile(join(root, "build.log"), log);
  }
  const attempts = await readFile(audit, "utf8");
  const verification = code === 0 ? await verifyIsolatedBuild(root, resolve(sourceRoot)) : null;
  const result = {
    root,
    exitCode: code,
    verification,
    networkAttempts: attempts.trim() ? attempts.trim().split("\n") : [],
  };
  await writeFile(join(root, "offline-build-result.json"), JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runOfflineBuild(process.argv[2] ?? process.cwd());
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode === 0 && result.networkAttempts.length === 0 ? 0 : 1;
}
