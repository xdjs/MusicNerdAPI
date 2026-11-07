# Isolated deterministic About acceptance project

Local preparation for #1655; no resources, credentials or deployment were created. Production routes/configuration remain unchanged. The generated project exposes only the actual artistBio route, a minimal same-origin test page, and Next's internal pages. It is not MusicNerdWeb acceptance coverage.

## Artifacts and commands

Use Node24 and existing repository dependencies:

```sh
node node_modules/vitest/vitest.mjs run docs/prototypes/hosted-about/__tests__
node docs/prototypes/hosted-about/runOfflineBuild.mjs "$PWD"
```

The runner creates a disposable build under `/tmp`, copies the static TypeScript dependency closure plus explicitly named adapters, copies the exact route, and generates relative configuration. It copies no environment files, fixture data, production Next configuration or arbitrary assets. Exact model mappings appear in both TypeScript paths and webpack aliases; the emitted-module audit fails if original model modules or the AI SDK enter the build. It retains the real Privy verifier and checks the route allowlist. The local build gets a fresh credential-free environment, disabled telemetry and a preload denying Node outbound transports.

A successful runner returns three paths:

- **Build root:** local verification evidence and installed-dependency symlink. Not distributable as-is.
- **Source package:**159 allowlisted files, including pinned dependency declarations, original lockfile, relative configuration and build verifier. No dependency symlinks, native binaries, environment files or external absolute source paths. This is the intended input for a future approved Vercel **source build**: isolated root, Node24, pinned pnpm, frozen lockfile, and `pnpm build`. Dependency installation and hosted build have not been run. The source package is not Vercel Build Output API output.
- **Standalone runtime:** Next's traced runtime/dependencies plus static assets and `server.cjs`. The packager rejects unexpected external links and credential/config filenames, reconstructs only traced package links, and normalizes build-only launcher metadata. Links resolve inside the bundle. It can be renamed and started with `node server.cjs` on the verified platform. **This bundle contains Darwin-arm64 Sharp binaries and is not a Linux/Vercel deployment artifact.** Build standalone on the actual target platform for a conventional Node/container host. It is not directly uploadable as Vercel Build Output API output.

Next retains absolute build identifiers in some compiled client-reference metadata; these are not external dependency links. Local relocation is tested with module resolution outside the bundle denied. Do not claim that every string in the standalone runtime is path-free. The source package has no such checkout references.

`smokePortableRuntime.mjs` copies the runtime again and tests a loopback server: page/static asset200, invalid artist400, unknown route404. It denies runtime outbound fetch/HTTP(S)/socket/TLS/DNS and external module resolution. Only literal127.0.0.1 lookup is answered locally so Node can bind its listener; no DNS request is made. This local check may require sandbox approval to listen. It does not use credentials or exercise a positive authenticated database write.

## Same-origin access

The page performs no generation on load. An operator enters a synthetic artist UUID and a real test-account bearer token; the token stays in component memory/password input, is never stored or logged, and can be cleared. Requests use a relative API URL with same-origin cookies. This avoids a separate protected Web-to-API origin: first obtain access to the protected deployment itself, then use a real Privy token for application authorization. No protection bypass secret, mock identity, auth shortcut or scenario flag is exposed to the browser.

Real Privy app configuration, a specifically approved test identity, synthetic database user/claim rows, and deployment access still need to be established. The page does not implement Privy login. A Privy token alone does not bypass Vercel Deployment Protection. Full MusicNerdWeb/SDK behavior is not covered.

## Determinism and network boundary

`createHostedAboutAdapter.ts` accepts an immutable server-code plan with success, failure, empty or wait-for-abort modes. Runtime defaults to success. Fault changes require a test-build source change and rebuild/restart; there is no HTTP control endpoint. Lore uses actual stored material/preset manifests, never fabricated approval or identity. Summary success returns null. Counters are process-local and count adapter boundaries, not provider calls/tokens or global cross-instance totals.

The audited route closure replaces the three model functions, excludes the AI SDK/original model entry points, and provides throwing lower-level AI aliases. This supplies deterministic provider-free model behavior for this artifact. Do not configure provider keys or provider OIDC billing capability. It is **not a general hosted network firewall**. Local build/smoke guards are not installed as production hosting egress controls: real hosted token verification and database access need their legitimate transports. Stored Lore/social source gathering on this route reads the database; it does not trigger research or remote extraction. The standard Next server also includes framework internals. Reaudit any added routes/dependencies; do not infer an unverified hosting add-on requirement or claim blanket egress enforcement.

## Verification and remaining limits

2026-11-04, Node24.16.0 / Next16.3.6 webpack: offline build and build types passed;2,111 audited modules; three synthetic adapters and real token verifier present; expected route/page allowlist; zero recorded network attempts. The final relocated Mac runtime returned page/static200, invalid artist400, unknown route404, with zero outbound attempts and external module resolution denied. Prototype tests and project TypeScript passed; targeted lint passed for covered files. The repository lint configuration ignores TSX, so the page is checked by TypeScript, Next build and Prettier, not claimed lint coverage.

Earlier alias-only artifacts referenced checkout sources/dependencies and were not portable; the source/standalone packaging above supersedes that limitation. Earlier Node23 results are historical; current verification uses Node24.

Route tests use fresh pathless PGlite and real Next route exports in-process. Only token signature verification is mocked within Vitest; real user lookup/edit authorization and source/lease/persistence code run. Fetch attempts throw and are asserted absent. This is not hosted token verification, native multi-session concurrency, complete migrations/RLS, browser interaction automation or real-provider quality/billing validation. Separate bootstrap/native tests cover their own documented scope.

Before hosted execution: approve the isolated target and costs; establish the reviewed synthetic database bootstrap and least-privilege credentials; configure real Privy/deployment access; install/build the source package on the actual host and repeat module/route audits; then test positive authenticated flow. No production/shared environment variables, real records, provider calls or remote changes are needed to prepare these local artifacts.
