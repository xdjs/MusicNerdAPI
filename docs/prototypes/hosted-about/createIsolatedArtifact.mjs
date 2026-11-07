import { copyFile, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { copyIsolatedSources } from "./copyIsolatedSources.mjs";

/** Generate a disposable, single-route Next project; never copy environment or production config. */
export async function createIsolatedArtifact(sourceRoot, parent) {
  sourceRoot = await realpath(sourceRoot);
  const root = await mkdtemp(join(parent, "mn-about-isolated-"));
  const copied = await copyIsolatedSources(sourceRoot, root);
  await writeFile(join(root, "source-manifest.json"), JSON.stringify(copied, null, 2));
  await copyFile(
    join(sourceRoot, "docs/prototypes/hosted-about/testPage.tsx"),
    join(root, "app/page.tsx"),
  );
  await writeFile(
    join(root, "app/layout.tsx"),
    'export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }',
  );
  await symlink(await realpath(join(sourceRoot, "node_modules")), join(root, "node_modules"));
  const packageSource = JSON.parse(await readFile(join(sourceRoot, "package.json"), "utf8"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "mn-about-isolated-test",
        private: true,
        engines: packageSource.engines,
        packageManager: packageSource.packageManager,
        dependencies: packageSource.dependencies,
        devDependencies: packageSource.devDependencies,
        scripts: { build: "next build --webpack && node verify-build.mjs", start: "next start" },
      },
      null,
      2,
    ),
  );
  await copyFile(join(sourceRoot, "pnpm-lock.yaml"), join(root, "pnpm-lock.yaml"));
  const verifier = await readFile(
    join(sourceRoot, "docs/prototypes/hosted-about/verifyIsolatedBuild.mjs"),
    "utf8",
  );
  await writeFile(
    join(root, "verify-build.mjs"),
    verifier + "\nconsole.log(await verifyIsolatedBuild(process.cwd(),process.cwd()));\n",
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
          paths: {
            ...Object.fromEntries(
              ["synthesizeArtistDoc", "generateAboutFromDoc", "generateLoreSummary"].map(name => [
                `@/lib/lore/${name}`,
                [`./docs/prototypes/hosted-about/${name}.ts`],
              ]),
            ),
            ...Object.fromEntries(
              ["generateText", "streamText", "generateArray", "generateObject"].map(name => [
                `@/lib/ai/${name}`,
                [`./docs/prototypes/hosted-about/${name}.ts`],
              ]),
            ),
            "@/*": ["./*"],
          },
        },
        include: ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx", ".next/types/**/*.ts"],
      },
      null,
      2,
    ),
  );
  const names = ["synthesizeArtistDoc", "generateAboutFromDoc", "generateLoreSummary"];
  const aiNames = ["generateText", "streamText", "generateArray", "generateObject"];
  const aliases = Object.fromEntries([
    ...names.map(name => [`@/lib/lore/${name}$`, `docs/prototypes/hosted-about/${name}.ts`]),
    ...aiNames.map(name => [`@/lib/ai/${name}$`, `docs/prototypes/hosted-about/${name}.ts`]),
  ]);
  const denied = [
    ...names.map(name => `lib/lore/${name}.ts`),
    ...aiNames.map(name => `lib/ai/${name}.ts`),
  ];
  await writeFile(
    join(root, "next.config.js"),
    `const fs=require('node:fs');const path=require('node:path');
module.exports={output:'standalone',outputFileTracingRoot:fs.realpathSync(path.dirname(__dirname)),experimental:{cpus:1},serverExternalPackages:['pdf-parse'],webpack(config,{isServer}){
 config.resolve.alias={...Object.fromEntries(Object.entries(${JSON.stringify(aliases)}).map(([k,v])=>[k,path.join(__dirname,v)])),...config.resolve.alias,'@':__dirname};
 if(isServer)config.plugins.push({apply(compiler){compiler.hooks.compilation.tap('SyntheticModuleAudit',compilation=>{compilation.hooks.finishModules.tap('SyntheticModuleAudit',modules=>{
 const resources=new Set();function visit(modules){for(const m of modules){if(m.resource)resources.add(m.resource.split('?')[0]);if(m.modules)visit(m.modules);}}visit(modules);
 const denied=${JSON.stringify(denied)}.map(p=>path.join(__dirname,p));for(const resource of resources){if(denied.includes(resource))throw new Error('Original model module reached isolated artifact: '+resource+' | '+[...modules].filter(m=>m.resource===resource).map(m=>m.rawRequest+' from '+compilation.moduleGraph.getIssuer(m)?.resource).join(','));}
 const output=path.join(__dirname,'.next','module-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});if(fs.existsSync(output))for(const old of JSON.parse(fs.readFileSync(output,'utf8')))resources.add(old);fs.writeFileSync(output,JSON.stringify([...resources].sort(),null,2));
 });});}});return config;}};
`,
  );
  return root;
}
