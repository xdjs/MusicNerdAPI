import { copyFile, mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAliases } from "./buildAliases.ts";

/** Generate a disposable, single-route Next project; never copy environment or production config. */
export async function createIsolatedArtifact(sourceRoot, parent) {
  sourceRoot = await realpath(sourceRoot);
  const root = await mkdtemp(join(parent, "mn-about-isolated-"));
  const route = "app/api/artistBio/[id]/route.ts";
  await mkdir(join(root, "app/api/artistBio/[id]"), { recursive: true });
  await copyFile(join(sourceRoot, route), join(root, route));
  await symlink(await realpath(join(sourceRoot, "node_modules")), join(root, "node_modules"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "mn-about-isolated-test", private: true }),
  );
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "esnext"],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          esModuleInterop: true,
          resolveJsonModule: true,
          allowJs: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": [`${sourceRoot}/*`] },
        },
        include: ["next-env.d.ts", "app/**/*.ts", ".next/types/**/*.ts"],
      },
      null,
      2,
    ),
  );
  const aliases = Object.fromEntries(
    Object.entries(buildAliases()).map(([key, value]) => [`${key}$`, value]),
  );
  const denied = ["synthesizeArtistDoc", "generateAboutFromDoc", "generateLoreSummary"]
    .map(name => join(sourceRoot, `lib/lore/${name}.ts`))
    .concat(
      ["generateText", "streamText", "generateArray", "generateObject"].map(name =>
        join(sourceRoot, `lib/ai/${name}.ts`),
      ),
    );
  await writeFile(
    join(root, "next.config.js"),
    `const fs=require('node:fs');const path=require('node:path');
module.exports={experimental:{cpus:1},serverExternalPackages:['pdf-parse'],webpack(config,{isServer}){
 config.resolve.alias={...config.resolve.alias,...${JSON.stringify(aliases)},'@':${JSON.stringify(sourceRoot)}};
 if(isServer)config.plugins.push({apply(compiler){compiler.hooks.compilation.tap('SyntheticModuleAudit',compilation=>{compilation.hooks.finishModules.tap('SyntheticModuleAudit',modules=>{
 const resources=new Set();function visit(modules){for(const m of modules){if(m.resource)resources.add(m.resource.split('?')[0]);if(m.modules)visit(m.modules);}}visit(modules);
 const denied=${JSON.stringify(denied)};for(const resource of resources){if(denied.includes(resource))throw new Error('Original model module reached isolated artifact: '+resource);}
 const output=path.join(${JSON.stringify(root)},'.next','module-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});if(fs.existsSync(output))for(const old of JSON.parse(fs.readFileSync(output,'utf8')))resources.add(old);fs.writeFileSync(output,JSON.stringify([...resources].sort(),null,2));
 });});}});return config;}};
`,
  );
  return root;
}
