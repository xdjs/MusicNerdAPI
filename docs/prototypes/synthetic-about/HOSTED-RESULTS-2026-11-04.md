# Hosted fixed-fixture preview — 2026-11-04

Ready deployment: `dpl_94QrDbfAK2JVdb17WbSSt1Pr6ffF`

- Preview: https://api-f3trv88sm-musicnerd.vercel.app
- Inspector: https://vercel.com/musicnerd/api/94QrDbfAK2JVdb17WbSSt1Pr6ffF
- Vercel target: Preview (`target: null`), existing MusicNerd API project.
- Linux build: passed, 40 seconds; PostgreSQL 18.3 / PGlite 0.5.8 WASM schema bootstrap passed with zero real records.
- Emitted-module audit: 1,725 modules; real Privy verifier retained; three deterministic model adapters; only `/api/acceptance` plus static/error pages. No original model implementation or shared PostgreSQL driver.
- Runtime unauthenticated empty POST: HTTP 401, `{"status":"not_signed_in"}`. Configuration guard therefore passed for this invocation; no authenticated fixture ran.

The first build passed Linux/WASM checks but deployment packaging failed (`dpl_28GAiKWFpXsnsNxTREDTpYxco82F`). Installing the same pinned dependencies with `node-linker=hoisted` fixed directory-symlink packaging. A second ready preview (`dpl_B27VELu5pmGFNcVZWfxWXGkdZWNU`) exposed Next's empty POST stream behavior. The final preview accepts EOF-only streams, rejects any supplied content, and bounds reads by cancellation and a two-second timeout under the capacity guard.

## Browser result: blocked before login

The approved admin account browser attempt stopped before email or OTP submission. The initial runner blocked Privy's static embedded-wallet iframe and analytics transport. Independent review approved allowing the exact static iframe/assets while continuing to discard analytics and block wallet/link API mutations. The login UI race was also corrected.

The next attempt stopped before email or OTP submission on a POST under `https://auth.privy.io/cdn-cgi/challenge-platform/h`. The diagnostic retains only a truncated path, not challenge values. No passwordless authentication response was observed. Both fresh contexts closed; no storage state, screenshots, traces or token values were retained. The regular account was not attempted because this common pre-login blocker remained.

Independent review recommended stopping: available evidence does not distinguish passive verification from an interactive challenge. No broad challenge-path exception, challenge-token injection, CAPTCHA solving or browser-detection changes were attempted. Hosted real-login-to-About success remains unproven.

## Verification and impact

- 20 provider-free tests passed (existing generation fixture suite plus nine wrapper tests).
- API TypeScript no-emit passed; scoped ESLint and formatting passed.
- Generator smoke check passed: nine direct runtime dependencies, pinned lock, temporary dependency symlink removed, hoisted package configuration and explicit deployment exclusions.
- Independent exact-code reviews covered dependency boundaries, request isolation, body bounds, browser authentication, request allowlists and failure handling; identified findings were fixed.
- Shared aliases rechecked unchanged: `staging.musicnerd.net` → `dpl_3PMSMnBpa8RQg1g4DV2Qw7gFpvVP`; `musicnerd-api-staging.vercel.app` → `dpl_FSUbftbEdU5vwSZQWUwnFTe1iUvs`.
- No shared database writes/migrations, live role changes, provider generation, new credentials, shared project-setting changes, production deployment or new subscription/resource commitment. Ordinary existing-plan preview usage occurred; no invoiced cost was established.

This preview cannot prove shared-database permissions, cross-request persistence/concurrency, live account roles, generation quality or full onboarding. Its roles and claim are synthetic fixtures. Normal Privy browser verification in an isolated interactive session is the next prerequisite; after that, run the exact preview with each approved account and inspect its bounded verdict. No shared migration is needed for this test.
