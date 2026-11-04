# Deterministic About test-build adapter (local preparation only)

These files prepare an isolated local test build of #1655. **They are not installed in production configuration and are not a deployed or ready-to-deploy application.** No request header, query parameter, body field, authentication shortcut or HTTP control endpoint enables them.

## Local verification

From the API checkout:

```sh
pnpm test docs/prototypes/hosted-about
```

The factory tests run without a database. The route tests use a fresh pathless PGlite instance per case and call the **real Next `GET`, `PUT` and `OPTIONS` route exports** in-process. This checks Request/Response serialization, missing/invalid-token rejection, real user lookup and edit authorization, real source/lease/persistence code, read-after-write, deterministic Lore/About failures and request cancellation. Privy signature verification is a Vitest-only mock, not part of the runtime adapter. Unused social inputs are mocked empty. Fetch is replaced with a throwing spy and asserted unused. This is not a network firewall, HTTP server, browser, native PostgreSQL locking or deployed authentication test. Fixtures never use application connection strings, private records or credentials.

## Runtime and build boundary

- `createHostedAboutAdapter.ts` accepts an immutable server-code plan. Supported modes per Lore/About/summary stage: success, failure, empty and wait-for-abort. The latter requires an AbortSignal and has no timer that outlives cancellation. Counters count boundary calls, not tokens/provider calls.
- `runtime.ts` creates the isolated build's singleton with the default success plan. Changing the plan requires changing test-build source and rebuilding/restarting. There is no remote scenario setter. Separate factory instances let local tests isolate scenarios.
- Three model wrappers replace Lore synthesis, About synthesis and summary generation. Lore uses the actual stored source loader, or the caller's exact preset manifest. The adapter never invents a source revision, approval or user identity. Summary success returns null; it does not exercise inventory prose quality.
- `buildAliases.ts` supplies explicit absolute module mappings for an isolated bundler. Four lower-level AI wrappers throw if an unexpected model entry point is reached. Production `next.config.ts`, routes, authentication and database code are unchanged.
- Counters are in-process and exposed only to trusted importing test code; there is no metrics route. They reset on restart and cannot prove global call counts across workers/instances. Fault configuration applies to the whole adapter instance; it is not a per-request switch.

**Do not attach these aliases to a production deployment.** `createIsolatedArtifact.mjs` creates a fresh temporary Next root with only an exact copy of the actual artistBio route, generated build config, a dependency symlink and source aliases. It copies no production config or environment files. `runOfflineBuild.mjs` builds that root with a fresh credential-free environment and a Node preload denying fetch, HTTP(S), socket/TLS and DNS entry points:

```sh
node docs/prototypes/hosted-about/runOfflineBuild.mjs "$PWD"
```

The runner uses existing dependencies only, disables telemetry, preserves a local build log/audit, and runs `verifyIsolatedBuild.mjs` after success. Webpack records all built source modules before optimization; the verifier requires all three synthetic model wrappers plus the real Privy verifier, rejects the original model modules and AI SDK, and permits only `/api/artistBio/[id]` plus Next's internal error pages. Empty audits fail. The generated config is separate from production. The artifact refers to local source/dependency paths and is **not a portable deployment bundle**. A portable hosted artifact must be built and verified again in its approved environment. Merely copying the alias map into the full application does not isolate its other endpoints.

Local verification on 2026-11-04: Next 16.3.6 webpack build and build TypeScript passed; 2,110 audited modules; expected route allowlist and three replacements verified; real token verifier retained; zero recorded network attempts. An initial build used Node23.11.0; the definitive rerun used the required Node24.16.0 and passed the same build/module/route/network checks. All17 prototype tests passed on Node24 in4.29s; project TypeScript and targeted lint also passed. Definitive logs: `/tmp/mn-hosted-about-node24-build.log` and `/tmp/mn-hosted-about-node24-tests.log`. The build timeout signals the parent process only; it is not a guaranteed process-tree or spending limit. In particular, the map is not an egress firewall and does not block arbitrary fetch/socket code. It does not replace the real database module; never boot it against staging/production credentials just to try the adapter.

## Required before any hosted execution

1. An explicitly approved disposable target and artifact root containing only the required test routes; repeat the emitted-module/route audit to prove model replacements and no production inclusion. Local webpack aliases were verified; the chosen hosted bundler/runtime still requires verification. No hosted build has been validated here.
2. A synthetic-only database/branch, full reviewed migrations/RLS/grants and bounded cleanup. PGlite fixtures are local test scaffolding, not deployment migrations or cross-session concurrency proof.
3. Real Privy configuration and a specifically approved test identity mapped to a synthetic claimant/admin in that isolated database. Existing production auth stays intact. No credentials have been obtained or changed here. A real Privy token does not bypass Vercel Deployment Protection: protected cross-origin Web-to-API requests also require an approved cookie/topology or server proxy. Never expose a protection bypass secret in browser code.
4. Explicit provider/network egress denial and no provider credentials/OIDC billing capability. The throwing AI aliases are defense in depth, not a substitute for deployment egress controls. Allow necessary authentication transport only after that boundary is defined.
5. Approved cost/time limits, isolated logs and a trusted way to observe per-instance counters. No public diagnostic/control endpoint should be added merely for convenience. Real HTTP/UI, serverless lifetime, deadlines and native concurrent transactions remain to validate.

No deployment, remote database change, provider request, package installation or production behavior change was performed for this prototype.
