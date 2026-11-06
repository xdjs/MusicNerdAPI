import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

/** Package Next's traced runtime, rewriting only the known build dependency link and build-only path metadata. */
export async function packageIsolatedRuntime(buildRoot, parent) {
  buildRoot = await realpath(buildRoot);
  const standalone = join(buildRoot, ".next/standalone");
  const appName = basename(buildRoot),
    app = join(standalone, appName);
  const tracingRoot = dirname(buildRoot);
  const mainLink = join(app, "node_modules");
  async function scan(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.name.startsWith(".env") || item.name === ".npmrc")
        throw new Error("Credential/config file refused");
      if (item.isSymbolicLink()) {
        const target = await readlink(path);
        const resolved = resolve(dirname(path), target);
        if (
          path !== mainLink &&
          (isAbsolute(target) || relative(standalone, resolved).startsWith(".."))
        )
          throw new Error(`External symlink: ${relative(standalone, path)}`);
      } else if (item.isDirectory()) await scan(path);
    }
  }
  await scan(standalone);
  const dependencyRoot = await realpath(join(buildRoot, "node_modules"));
  const dependencyRelative = relative(tracingRoot, dependencyRoot);
  if (dependencyRelative.startsWith("..") || isAbsolute(dependencyRelative))
    throw new Error("Dependencies outside reviewed tracing root");
  const tracedDependencies = join(standalone, dependencyRelative);
  await lstat(tracedDependencies);
  const output = await realpath(await mkdtemp(join(parent, "mn-about-portable-")));
  await cp(standalone, output, {
    recursive: true,
    verbatimSymlinks: true,
    filter: source => source !== mainLink,
  });
  const copiedApp = join(output, appName),
    copiedDependencies = join(output, dependencyRelative);
  await symlink(relative(copiedApp, copiedDependencies), join(copiedApp, "node_modules"));
  // Next traces package contents but retains the build's top-level node_modules symlink.
  // Recreate only entry links whose package contents were actually traced into this bundle.
  async function linkPackages(dir, prefix = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const name = join(prefix, entry.name),
        source = join(dir, entry.name);
      if (entry.name.startsWith("@") && entry.isDirectory()) {
        await linkPackages(source, name);
        continue;
      }
      const target = await realpath(source);
      const rel = relative(tracingRoot, target);
      if (rel.startsWith("..") || isAbsolute(rel)) continue;
      const packaged = join(output, rel);
      if (!(await lstat(packaged).catch(() => null))) continue;
      const link = join(copiedDependencies, name);
      if (await lstat(link).catch(() => null)) continue;
      await mkdir(dirname(link), { recursive: true });
      await symlink(relative(dirname(link), packaged), link);
    }
  }
  await linkPackages(dependencyRoot);
  await cp(join(buildRoot, ".next/static"), join(copiedApp, ".next/static"), { recursive: true });
  const serverPath = join(copiedApp, "server.js");
  let server = await readFile(serverPath, "utf8");
  const match = server.match(/const nextConfig = (.+)\n/);
  if (!match) throw new Error("Unrecognized standalone launcher");
  const config = JSON.parse(match[1]);
  delete config.outputFileTracingRoot;
  delete config.repoRoot;
  if (config.turbopack) delete config.turbopack.root;
  server = server.replace(
    match[0],
    `const nextConfig = ${JSON.stringify(config)}\nnextConfig.outputFileTracingRoot=path.dirname(dir);nextConfig.repoRoot=dir;if(nextConfig.turbopack)nextConfig.turbopack.root=path.dirname(dir);\n`,
  );
  await writeFile(serverPath, server);
  const requiredPath = join(copiedApp, ".next/required-server-files.json");
  const required = JSON.parse(await readFile(requiredPath, "utf8"));
  required.appDir = ".";
  required.config = config;
  await writeFile(requiredPath, JSON.stringify(required));
  await writeFile(
    join(output, "server.cjs"),
    `require(${JSON.stringify(`./${appName}/server.js`)});\n`,
  );
  // Validate links after rewriting, including chained links. Nothing can resolve back into the checkout.
  let files = 0;
  async function check(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        if (isAbsolute(await readlink(path))) throw new Error("Absolute runtime symlink");
        if (relative(output, await realpath(path)).startsWith(".."))
          throw new Error("Runtime link escapes bundle");
      } else if (entry.isDirectory()) await check(path);
      else files++;
    }
  }
  await check(output);
  return { root: output, appDirectory: appName, files };
}
