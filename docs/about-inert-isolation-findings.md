# #1655 inert isolation findings

2026-11-04. No values or customer data were collected. Do not treat this as staging acceptance.

The inert preview (dpl_2c3hWXhHNnJgPRmvpVmiiqM9X5jw) returned build pass=false (OIDC nonempty, two unknown credential-like variables) and runtime503 (one unknown credential-like variable). All thirteen configured Preview variables plus environment OIDC had deployment-only blank overrides. Shared settings/aliases were unchanged. No DB/provider/auth code exists in that preview.

Read-only raw deployment metadata names VERCEL_AUTOMATION_BYPASS_SECRET as the sole regex-matching name outside the probe's known list. It is the likely runtime match, not a proven match between a particular nonempty value and the count. Another build-time name is still unidentified; injected runtime/build variables need not all appear in deployment metadata. The current endpoint emits counts only, so exact remaining identity cannot be recovered from it without a changed diagnostic deployment. No such deployment was performed under the subsequent no-spend/no-deploy restriction.

The automation bypass variable is an access credential, not harmless metadata or a demonstrated model API key. Official documentation says it bypasses deployment protection and related protections: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation . Do not whitelist or expose it.

More importantly, Vercel documents runtime OIDC in the x-vercel-oidc-token request header, whereas the build receives VERCEL_OIDC_TOKEN: https://vercel.com/docs/environment-variables/system-environment-variables . The API project's read-only oidcTokenConfig is enabled with team issuer. Empty environment OIDC never proved runtime absence. The local application wrapper now rejects header presence (even an empty value) before loading real code; two regressions failed200 before the fix and pass503 afterward. Existing environment refusal stays intact. Four focused files/34 tests and targeted lint passed. This does not change the deployed inert probe.

Existing Music Nerd project inventory did not establish a clean alternate host: ten projects report OIDC enabled; Web app's setting is unreported and its Preview contains AI Gateway/provider secrets. No unrelated project was repurposed, settings changed or credentials created.

## Concrete path and limits

Keep the failed hosted guard closed. Under the current no-deployment/no-spend constraint, the immediately executable verification is the existing local synthetic route/database suite, with deterministic generation and network denial:

    node node_modules/vitest/vitest.mjs run docs/prototypes/hosted-about/__tests__/bootstrapRoute.test.ts docs/prototypes/hosted-about/__tests__/realPrivyVerification.test.ts

Use Node24 in the isolated API worktree; the nativePG17 runner remains available for DB concurrency. This is local evidence, not hosted browser-login acceptance. No live account login is part of that command.

For hosted acceptance, a names-only diagnostic revision (still refusing) is needed to identify the extra build variable and observe header presence; it entails another deployment and possible metered usage, so is not executable under the present instruction. A prebuilt artifact would remove the remote application build but not runtime/header credentials. Provider aliases plus a module audit remove reviewed model-call paths, yet are not a network security boundary: other SDKs, direct HTTP/TCP, redirects, workers or a credential-bearing host can still have capabilities. Replacing the env guard with a patched fetch wrapper would weaken the claim, not solve it.

A truly enforced outbound policy permitting only explicitly selected auth and synthetic DB endpoints could establish no-provider egress; such enforcement is not verified for this existing Vercel Functions project. Do not claim Vercel's inbound firewall or static egress IPs provide that policy. A new sandbox or networking product would add infrastructure/cost and is not the smallest authorized next step.

Independent review recommends local same-origin verification while retaining hosted refusal. There is no fully verified hosted executable solution under all current restrictions; identifying this boundary is preferable to bypassing the guard or declaring a static demonstration to be API acceptance.
