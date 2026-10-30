import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("braintrust"))("esbuild");
const state = resolve("benchmarks/pdf106v2/runtime.ts");
const adapters = {
  "@/lib/db/db": `import {db as real} from ${JSON.stringify(resolve("lib/db/db.ts"))}; export const db=new Proxy({}, {get(_,k){const target=runtime.synthetic?runtime.db:real; if(!target)throw Error('Fixture DB missing');const v=target[k];return typeof v==='function'?v.bind(target):v;}});`,
  "@/lib/questionResearch/loadResearchArtist": `import {loadResearchArtist as real} from ${JSON.stringify(resolve("lib/questionResearch/loadResearchArtist.ts"))}; export async function loadResearchArtist(id){if(!runtime.synthetic)return real(id);if(id!==ARTIST)throw Error('Wrong fixture artist');return {id,name:'Dutchyyy'};}`,
  "@/lib/questionResearch/loadPublicResearchOriginals": `import {loadPublicResearchOriginals as real} from ${JSON.stringify(resolve("lib/questionResearch/loadPublicResearchOriginals.ts"))}; export async function loadPublicResearchOriginals(id){if(!runtime.synthetic)return real(id);if(id!==ARTIST)throw Error('Wrong fixture artist');return [];}`,
  "@/lib/questionResearch/getQuestionVisitorKey": `import {getQuestionVisitorKey as real} from ${JSON.stringify(resolve("lib/questionResearch/getQuestionVisitorKey.ts"))};export async function getQuestionVisitorKey(r){return runtime.synthetic?'f'.repeat(64):real(r);}`,
  "@/lib/storage/getPublicUrl": `import {getPublicUrl as real} from ${JSON.stringify(resolve("lib/storage/getPublicUrl.ts"))};export function getPublicUrl(b,p){return runtime.synthetic?ORIGIN+'/storage/v1/object/public/'+b+'/'+p:real(b,p);}`,
  "@/lib/search/webSearch": `import {webSearch as real} from ${JSON.stringify(resolve("lib/search/webSearch.ts"))};export async function webSearch(...args){if(!runtime.synthetic)return real(...args);runtime.syntheticWebAttempts++;return [];}`,
};
await build({
  entryPoints: [process.argv[2] ?? "benchmarks/pdf106v2/run.ts"],
  outfile: ".next/pdf106v2-run.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [
    {
      name: "isolated-boundaries",
      setup(b) {
        b.onResolve({ filter: /^next\/(server|headers|cache)$/ }, a => ({
          path: require.resolve(a.path),
          external: true,
        }));
        b.onResolve({ filter: /^@\// }, a =>
          adapters[a.path] ? { path: a.path, namespace: "fixture-boundary" } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "fixture-boundary" }, a => ({
          loader: "js",
          contents:
            `import {runtime,ARTIST,ORIGIN} from ${JSON.stringify(state)};` + adapters[a.path],
          resolveDir: process.cwd(),
        }));
        b.onResolve({ filter: /^ai$/ }, () => ({ path: "sdk", namespace: "observer" }));
        b.onResolve({ filter: /^pdfv2-real-ai$/ }, () => ({
          path: require.resolve("ai"),
          external: true,
        }));
        b.onLoad({ filter: /.*/, namespace: "observer" }, () => ({
          loader: "js",
          contents: `export * from 'pdfv2-real-ai';import {streamText as original} from 'pdfv2-real-ai';import {runtime} from ${JSON.stringify(state)};export function streamText(options){const bounded={...options,maxOutputTokens:2048,maxRetries:0,...(runtime.model?{model:runtime.model}:{})};runtime.modelOptions.push({maxOutputTokens:bounded.maxOutputTokens,maxRetries:bounded.maxRetries});const result=original(bounded);runtime.observe?.(result);return result;}`,
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
