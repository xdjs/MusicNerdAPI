# #1655 existing-project preview preparation

Local preparation only, 2026-11-04. No preview was deployed, environment changed, fixture inserted, credential decrypted or message sent. This is a narrower alternative to creating another project; it does not authorize shared staging changes.

## What metadata establishes

The existing API project has a `staging` custom environment matched to `main`, with `musicnerd-api-staging.vercel.app` serving shared clients. Ordinary Preview variables are not empty: metadata includes `TAVILY_API_KEY`, `APIFY_API_TOKEN`, `MUSICNERD_RESEARCH_API_KEY`, `DISCORD_WEBHOOK_URL`, `RESEND_API_KEY`, Spotify credentials, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, alongside the required database and Privy variables. These are not confined to production. A new branch or unnamed preview does not itself isolate credentials.

The connected create-deployment tool accepts source/project/target settings but exposes no deployment-specific `env`/`build.env` fields. Do not attempt to smuggle unsupported properties through it. Official CLI documentation supports `--build-env` and `--env` for deployment-specific values. An approved operator could test empty overrides for every unwanted key at both build and runtime without changing project variables. This is a candidate mechanism, not observed hosted absence: empty-value precedence, shared/system variables and automatic `VERCEL_OIDC_TOKEN` injection remain unverified. The latter may provide AI Gateway capability even without a provider API key. No shared project OIDC or protection setting may be changed under this plan.

Sources: [CLI deployment variables](https://vercel.com/docs/cli/deploy), [environment scopes](https://vercel.com/docs/deployments/environments). Metadata was fetched with `decrypt=false`; values were neither printed nor saved.

## Prepared adapter

`prototypes/hosted-about/prepareExistingPreview.mjs` creates a separate local source root using the existing deterministic model adapter. It preserves the actual About route as `actualRoute.ts`, then puts `createExistingPreviewHandler.ts` in front of GET/PUT. The wrapper accepts only one build-fixed synthetic artist UUID and requires the three approved auth/database settings, requires a PostgreSQL URI and rejects every unexpected nonempty environment variable using an explicit name allowlist before dynamically loading the real route. Other artists get 404; missing settings or unexpected variables get 503 without values or key names in the HTTP response. Privy endpoint overrides, PostgreSQL fallback settings and OIDC are rejected. Unknown host variables also fail until explicitly reviewed. Original authorization, provenance and database behavior are delegated unchanged. OPTIONS is a same-origin test-only empty 204. This wrapper is never inserted into production source.

This guard prevents the test handler from proceeding with unexpected process credentials. It does **not** prevent secrets being delivered to dependency installation/build processes, establish a network firewall, or prove their absence on Vercel. It also does not establish database identity from a connection string. Those are explicit operator preflight checks. OIDC causes refusal too; if the existing project cannot omit it for this one deployment, this exact strict adapter cannot run there without a separate reviewed policy decision. Do not silently weaken it.

Local preparation command (no deployment):

```js
import { prepareExistingPreview } from "./docs/prototypes/hosted-about/prepareExistingPreview.mjs";
await prepareExistingPreview(process.cwd(), "/tmp", approvedSyntheticArtistId);
```

The UUID must belong to a newly approved fictional fixture. Preparation does not create or reserve it. The local tests use a fictional UUID only. Rebuild and audit this new source variant; the earlier source archive does not contain this wrapper and must not be mistaken for it. No production environment/config, credentials or customer rows are copied.

## Narrow execution proposal, not executed

1. Start with the existing documented browser test identities described in the reassessment below. Verify the live token audience and API subject/role mapping; do not select a user by email. Contact an auth owner only if this path actually fails. No new app/secret/plan is assumed.
2. Verify incremental schema compatibility read-only. Do not run the fresh-install bootstrap against shared staging, change unknown reader grants, or seed the production 16-bio exception. If required additive migrations are absent, obtain a separately scoped migration approval first.
3. Before any upload, approve deployment-specific credential overrides and inspect the resulting plan for project, target `preview`, no `main` branch identity, no custom-environment target, no alias/promotion and no project settings writes. Use the generated one-route source variant, not the full API or shared staging alias. Confirm protection for the individual preview without altering shared settings; currently project metadata shows no enabled SSO protection, so protected access is not established.
4. After credential isolation is established at both build and runtime, approve one fictional artist/claim/source fixture and its exact cleanup record in the staging database. The source is pre-extracted synthetic text; no extraction, upload, notification or model API is intended. Artist INSERT itself queues catalog matching: the approved fixture transaction must terminalize only its synthetic catalog job before commit, as tested below. Verify target triggers/workers before any seed; a bare artist INSERT is unsafe. Scope every request to that fixed fixture. Actual database target identity and fixture ownership must be checked before writes.
5. Run one authenticated missing-doc regeneration, existing-doc reuse, outsider denial, prerequisite/About failure and source-withdrawal checks. Use the actual Privy login/token flow; no authentication bypass. Clean only this fixture and delete only this preview deployment. Never delete the existing project or pause the team.

The preview avoids a new project subscription but may incur build/runtime usage. Shared staging migrations, fixture writes, deployment, protection changes and any credential-scope exception are not authorized by preparation. No claim that this is executable today: the narrow unresolved items are a successful existing-fixture login and subject confirmation, deployment-specific credential/OIDC isolation, preview access protection and schema/fixture approval.

## Auth ownership evidence and unsent question

Verified recipient: **Sweetman, GitHub `sweetmantech`**, the author/assignee and explicit owner of [#1628](https://github.com/xdjs/MusicNerdWeb/issues/1628). [#1595](https://github.com/xdjs/MusicNerdWeb/issues/1595) records authenticated preview checks awaiting Sweetman's login code. This identifies the current auth implementation/test coordinator; it does not prove his current Privy Dashboard Admin role or identify a reusable service/test account.

Carl (`clt`) is a documented historical Privy operator: [#972](https://github.com/xdjs/MusicNerdWeb/issues/972) concerns Dashboard configuration, and the [October 6 transcript](https://github.com/xdjs/MusicNerdWeb/blob/main/docs/rnd/transcripts/2026-10-06-standup-bf7e1b5e48a6.md) records his successful staging/production login check. The old migration plans describe setup but cannot establish today's dashboard role. Those ownership sources did not establish a reusable test identity; the subsequent repository and database review below does. Current Privy administrator status remains unproven. Do not substitute an arbitrary existing user's database row.

Earlier unsent draft to Sweetman (`@sweetmantech`), superseded as the next step by existing test fixtures:

> For #1655, can you confirm which existing Privy app is used by API staging, who currently has Privy Admin access, and which existing human-operated test account we may use for one fictional artist? We want to reuse staging auth without creating or rotating credentials or adding a paid plan. Please also confirm whether that app is isolated from production and whether a fresh login changes its billing tier. No secrets or access tokens are needed in your reply; we can use the approved browser login flow when the fixture is ready.

## Local verification

The updated hosted-adapter suite passed 55 tests across 12 files on Node 24.16.0 (4.63 seconds). Tests cover mismatched artists before import, required configuration, explicit URI host/user/database, Privy endpoint and PG fallback rejection, OIDC/unknown-variable refusal, no credential echo, and preserving the delegated authorization response. Type checking and targeted lint passed; independent review closed the endpoint-override and database-fallback findings.

The final generated source at `/tmp/mn-about-isolated-GX3EyY` passed an offline Next 16.3.6 Webpack/type build on Node 24. The module audit found 2,113 modules, the real Privy verifier, all three deterministic model adapters, and only the test page/About route plus Next internal pages. No network attempts were recorded by the deny-network preload. Logs: `/tmp/mn-existing-preview-build.log` and `/tmp/mn-existing-preview-alltests.log`. The corresponding 161-file source package is `/private/tmp/mn-about-source-nsV765`; it is not uploaded or deployment-approved. No HTTP request against a live database or Privy account was made; local build evidence does not establish hosted credential override behavior.

## Auth reassessment: reuse existing fixtures first (2026-11-04)

Recommendation: do not request a new Privy setup or interrupt Sweetman now. Web already documents regular and admin Privy test identities in `e2e/user-auth.spec.ts` and `e2e/vault-upload.spec.ts`. Keep their addresses and OTPs out of reports, traces and artifacts. A read-only aggregate lookup in the existing Dev database found one admin fixture row (admin, whitelisted, linked) and two regular fixture rows (neither admin nor whitelisted), with two distinct nonempty Privy subjects. This proves database presence and roles only, not that either fixture remains enabled in the current staging Privy app. Resolve the actual verified JWT subject through the API; never choose one of the duplicate-email rows manually. No login or live HTTP mutation was attempted.

`e2e/helpers/auth.ts` performs genuine Privy email/OTP login but waits for `/api/auth/session`. That is unsuitable for the NextAuth-free #1628 branch. `fetchAsUser` also does not supply a Bearer token. The existing `/access` page and `src/hooks/useAccessToken.ts` obtain the real token through `usePrivy().getAccessToken()`. Reuse that SDK path with tokens held only in memory; do not save browser traces, screenshots containing tokens, HARs or token output. Confirm the Web/API app audience and actual API subject mapping. A Web cookie or retired-route 404 proves neither. Do not run the full vault upload spec: it chooses the first homepage artist and mutates storage and database rows.

The existing release workflow is an eventual authorized deployment path, not a sandbox: `staging-release` runs gated on main/manual input, builds, checks health and assigns the shared staging alias. CI does not run these Playwright identity checks. Do not dispatch it to obtain an isolated preview or treat its environment approval as provider credential isolation.

### Smallest execution sequence for approval

1. Complete the already identified schema/credential-isolation/fixture prerequisites. Existing test identities remove the presumed dependency on a new auth account; they do not remove these requirements.
2. In an approved browser run, log in with the documented admin fixture using genuine Privy UI. Obtain its access token through the SDK and verify the actual API guard. The locally inspected candidate accepts a PUT with JSON `null` only through authentication/authorization, then returns 400 `Invalid bio` without writes. Signed-out must return 401; the regular fixture must return 403. This probe is valid only after confirming that exact deployed handler ordering; do not send regeneration parameters as a read-only probe.
3. Execute deterministic regeneration only against the approved synthetic fixture using the guarded adapter. Separately test admin, unrelated non-admin, trusted contributor without a claim (403), and approved claimant. Approval of evidence does not grant About-edit permission. Test pinned content (200 unchanged, no generation), unpinned About failure (500, prior content preserved), and source rejection/withdrawal independently.
4. If fixture login is unavailable, use Pete's existing staging session with his participation. An admin session alone cannot establish non-admin denial or claimant behavior. Only a demonstrated account/app problem warrants the earlier owner question. Do not create credentials or change a real account's roles as a shortcut.

### Local evidence and boundaries

Two focused files passed 15 tests on Node 24.16.0 in 5.17 seconds. `realPrivyVerification.test.ts` uses the actual installed Privy SDK with ephemeral synthetic ES256 keys, mocking only app-key discovery. It tests valid signature, issuer/audience, expiration, future not-before, wrong signing key, forbidden algorithm and malformed/shortcut tokens. It does not prove remote key discovery or browser login.

`bootstrapRoute.test.ts` calls the real Next route exports against the full synthetic schema/functions/grants in PGlite. It mocks token resolution and model boundaries, preserving the real API role guard and evidence gathering. Tests cover admin success, unrelated-user denial, claimant success, whitelist-only denial despite usable public evidence, malformed-body no-write auth probing, pin preservation, claimant failure preservation and rejected evidence. The claimant preservation fixture establishes approved public Lore preservation, not immutable trusted-submission provenance. That separate provenance policy still needs its own suite and hosted acceptance coverage.

The fixture seeds in one transaction and marks only its automatically queued `catalog_match` row `done` with explicit outcome `synthetic_fixture_do_not_run` before commit. This prevents worker-visible runnable jobs under the tested trigger; a later bio update sees the same anchor and does not requeue. This is synthetic fixture bookkeeping, not a claim that research ran. Actual target trigger/worker parity remains a preflight requirement. No real rows or queues were modified.
