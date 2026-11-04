import {
  readFile,
  writeFile,
  copyFile,
  mkdir,
  rename,
  rm,
  readdir,
  unlink,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { createIsolatedArtifact } from "../hosted-about/createIsolatedArtifact.mjs";
export async function prepareSynthetic(sourceRoot, parent, subjects) {
  if (
    !Object.keys(subjects).length ||
    Object.entries(subjects).some(([k, v]) => !/^[a-f0-9]{64}$/.test(k) || typeof v !== "boolean")
  )
    throw Error("Invalid subject manifest");
  const root = await createIsolatedArtifact(sourceRoot, parent);
  const dir = join(root, "docs/prototypes/synthetic-about");
  await mkdir(dir, { recursive: true });
  for (const f of ["context.ts", "fixture.ts", "modelRuntime.ts", "acceptance.ts"])
    await copyFile(join(sourceRoot, "docs/prototypes/synthetic-about", f), join(dir, f));
  await mkdir(join(root, "synthetic-sql"));
  for (const f of [
    "fresh-schema.bootstrap.sql",
    "bootstrap-functions.sql",
    "bootstrap-reset-access.sql",
    "bootstrap-access.sql",
    "bootstrap-audit.sql",
  ])
    await copyFile(
      join(sourceRoot, "docs/prototypes/hosted-about", f),
      join(root, "synthetic-sql", f),
    );
  await rename(join(root, "app/api/artistBio/[id]/route.ts"), join(dir, "actualRoute.ts"));
  await rm(join(root, "app/api/artistBio"), { recursive: true });
  await writeFile(
    join(root, "lib/db/db.ts"),
    `export {db} from '@/docs/prototypes/synthetic-about/context';\nexport type {WriteDb} from '@/docs/prototypes/synthetic-about/context';\n`,
  );
  await writeFile(
    join(root, "docs/prototypes/hosted-about/runtime.ts"),
    `export {adapter} from '@/docs/prototypes/synthetic-about/modelRuntime';\n`,
  );
  await mkdir(join(root, "app/api/acceptance"), { recursive: true });
  await writeFile(
    join(root, "app/api/acceptance/route.ts"),
    `import {createAcceptance} from '@/docs/prototypes/synthetic-about/acceptance';
export const dynamic='force-dynamic';export const maxDuration=60;
// This isolated process serves only synthetic acceptance. Never log raw app/SDK errors.
for(const name of ['log','info','warn','error','debug'] as const)console[name]=()=>{};
const subjects=${JSON.stringify(subjects)};
const handler=createAcceptance({subjects,verify:async token=>(await import('@/lib/auth/verifyPrivyAccessToken')).verifyPrivyAccessToken(token),loadRoutes:()=>import('@/docs/prototypes/synthetic-about/actualRoute')});
export async function POST(request:Request){
 if(process.env.PRIVY_APP_ID!=='cmiqjqibx00e1l40dxpe67mq6'||!process.env.PRIVY_APP_SECRET||['SUPABASE_DB_CONNECTION','SUPABASE_SERVICE_ROLE_KEY','TAVILY_API_KEY','APIFY_API_TOKEN','MUSICNERD_RESEARCH_API_KEY','AI_GATEWAY_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY','PRIVY_API_URL','PRIVY_WALLET_API_URL'].some(k=>Boolean(process.env[k])))return Response.json({status:'test_configuration_refused'},{status:503});
 return handler(request);
}
`,
  );
  await writeFile(
    join(root, "app/page.tsx"),
    `'use client';import {useEffect,useState} from 'react';export default function Page(){const[ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const[token,setToken]=useState('');const[result,setResult]=useState('');const[busy,setBusy]=useState(false);return <main><h1>Synthetic About acceptance</h1><p>Real staging test token; disposable synthetic database. No shared profiles or provider generation.</p><input aria-label="Test access token" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/><button disabled={!ready||busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/acceptance',{method:'POST',headers:{Authorization:'Bearer '+token},credentials:'same-origin'});setResult(JSON.stringify({http:r.status,result:await r.json()}));}catch{setResult('Request failed');}finally{setToken('');setBusy(false);}}}>Run fixed acceptance</button><pre>{result}</pre></main>}`,
  );
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const deps = [
    "@electric-sql/pglite",
    "@privy-io/server-auth",
    "drizzle-orm",
    "next",
    "react",
    "react-dom",
    "zod",
    "parse5",
    "stemmer",
  ];
  const dev = ["typescript", "@types/node", "@types/react", "@types/react-dom"];
  const versions = async names =>
    Object.fromEntries(
      await Promise.all(
        names.map(async name => [
          name,
          JSON.parse(await readFile(join(sourceRoot, "node_modules", name, "package.json"), "utf8"))
            .version,
        ]),
      ),
    );
  await copyFile(
    join(sourceRoot, "docs/prototypes/synthetic-about/verify-wasm.mjs"),
    join(root, "verify-wasm.mjs"),
  );
  pkg.scripts.build = "next build --webpack && node verify-build.mjs && node verify-wasm.mjs";
  pkg.dependencies = await versions(deps);
  pkg.devDependencies = await versions(dev);
  await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2));
  await copyFile(
    join(sourceRoot, "docs/prototypes/synthetic-about/preview.pnpm-lock.yaml"),
    join(root, "pnpm-lock.yaml"),
  );
  let config = await readFile(join(root, "next.config.js"), "utf8");
  config = config.replace("fs.realpathSync(path.dirname(__dirname))", "fs.realpathSync(__dirname)");
  config = config.replace(
    "serverExternalPackages:['pdf-parse']",
    "serverExternalPackages:['@electric-sql/pglite'],outputFileTracingIncludes:{'/api/acceptance':['./synthetic-sql/*.sql','./node_modules/@electric-sql/pglite/dist/**/*']}",
  );
  await writeFile(join(root, "next.config.js"), config);
  let verify = await readFile(join(root, "verify-build.mjs"), "utf8");
  verify = verify.replaceAll("/api/artistBio/[id]/route", "/api/acceptance/route");
  verify = verify.replace(
    "return {\n    moduleCount:",
    `if(modules.some(m=>/\\/node_modules\\/(?:\\.pnpm\\/[^/]+\\/node_modules\\/)?(?:postgres\\/|ai\\/|@ai-sdk\\/|braintrust\\/|workflow\\/)/.test(m)))throw Error('Forbidden dependency');\n  const dbSource=await readFile(join(root,'lib/db/db.ts'),'utf8');if(dbSource.includes('SUPABASE_DB_CONNECTION')||dbSource.includes('postgres('))throw Error('Shared DB boundary present');\n  return {\n    moduleCount:`,
  );
  await writeFile(join(root, "verify-build.mjs"), verify);
  // Walk the final alias-aware source closure, then remove unreachable copied sources.
  const ts = createRequire(join(sourceRoot, "package.json"))("typescript");
  const parsed = ts.parseJsonConfigFileContent(
    JSON.parse(await readFile(join(root, "tsconfig.json"), "utf8")),
    ts.sys,
    root,
  );
  const pending = ["app/api/acceptance/route.ts", "app/page.tsx", "app/layout.tsx"],
    keep = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (keep.has(file)) continue;
    keep.add(file);
    const path = join(root, file);
    const text = await readFile(path, "utf8");
    for (const imp of ts.preProcessFile(text, true, true).importedFiles) {
      if (!imp.fileName.startsWith(".") && !imp.fileName.startsWith("@/")) continue;
      const r = ts.resolveModuleName(imp.fileName, path, parsed.options, ts.sys).resolvedModule;
      if (!r) throw Error("Unresolved " + imp.fileName);
      const child = relative(root, resolve(r.resolvedFileName));
      if (child.startsWith("..")) throw Error("Source escape");
      pending.push(child);
    }
  }
  async function prune(path) {
    for (const e of await readdir(path, { withFileTypes: true })) {
      const p = join(path, e.name);
      if (e.isDirectory()) await prune(p);
      else if (/\.tsx?$/.test(e.name) && !keep.has(relative(root, p))) await rm(p);
    }
  }
  await prune(join(root, "lib"));
  await prune(join(root, "docs"));
  await writeFile(join(root, "source-manifest.json"), JSON.stringify([...keep].sort(), null, 2));
  await writeFile(
    join(root, "vercel.json"),
    JSON.stringify({
      framework: "nextjs",
      installCommand: "pnpm install --frozen-lockfile --ignore-scripts",
      buildCommand: "pnpm run build",
      functions: { "app/api/acceptance/route.ts": { maxDuration: 60 } },
    }),
  );
  await writeFile(join(root, ".npmrc"), "node-linker=hoisted\n");
  await unlink(join(root, "node_modules"));
  await writeFile(
    join(root, ".vercelignore"),
    "node_modules\n.next\n.env*\n.git\n*.log\n*.tsbuildinfo\n",
  );
  return root;
}
