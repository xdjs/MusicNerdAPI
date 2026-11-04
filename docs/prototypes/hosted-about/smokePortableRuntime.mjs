import { cp, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Relocate the runtime and exercise only loopback/static/invalid-ID paths, with outbound network denied. */
export async function smokePortableRuntime(bundleRoot) {
  const root = await realpath(await mkdtemp("/tmp/mn-about-relocated-"));
  await cp(bundleRoot, root, { recursive: true, verbatimSymlinks: true });
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const audit = join(root, "network-attempts.log");
  await writeFile(audit, "");
  const env = {
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: root,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    SYNTHETIC_RUNTIME_ROOT: root,
    SYNTHETIC_NETWORK_AUDIT: audit,
    NODE_OPTIONS: `--require=${fileURLToPath(new URL("./deny-runtime-external.cjs", import.meta.url))}`,
  };
  const child = spawn(process.execPath, [join(root, "server.cjs")], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  let ready;
  const started = new Promise((resolve, reject) => {
    ready = resolve;
    child.once("error", reject);
    child.once("exit", code => reject(new Error(`Runtime exited before ready: ${code}: ${log}`)));
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", chunk => {
      log += chunk;
      if (log.includes("Ready")) ready();
    });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Runtime startup timed out")), 20000);
  });
  try {
    await Promise.race([started, timeout]);
    clearTimeout(timer);
    const base = `http://127.0.0.1:${port}`;
    const page = await fetch(base, { signal: AbortSignal.timeout(5000) });
    const html = await page.text();
    if (page.status !== 200 || !html.includes("Synthetic About test"))
      throw new Error("Synthetic page missing");
    const script = html.match(/src="([^" ]*\/_next\/static\/[^" ]+\.js)"/);
    if (!script) throw new Error("Static JS reference missing");
    const asset = await fetch(new URL(script[1], base), { signal: AbortSignal.timeout(5000) });
    if (asset.status !== 200) throw new Error("Packaged static asset missing");
    await asset.arrayBuffer();
    const api = await fetch(`${base}/api/artistBio/not-a-uuid?regenerate=true`, {
      signal: AbortSignal.timeout(5000),
    });
    if (api.status !== 400) throw new Error(`Route smoke expected400 got${api.status}`);
    await api.json();
    const extra = await fetch(`${base}/api/not-allowed`, { signal: AbortSignal.timeout(5000) });
    if (extra.status !== 404) throw new Error("Unexpected route exposed");
    await extra.text();
    const attempts = await readFile(audit, "utf8");
    if (attempts.trim()) throw new Error("Runtime attempted outbound network");
    const result = {
      root,
      page: 200,
      staticAsset: 200,
      invalidArtist: 400,
      unknownRoute: 404,
      outboundAttempts: 0,
      externalModuleResolution: "denied",
    };
    await writeFile(join(root, "smoke-result.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    clearTimeout(timer);
    child.kill("SIGTERM");
    await new Promise(resolve => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", resolve);
    });
    await writeFile(join(root, "runtime.log"), log);
  }
}
