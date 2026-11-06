# #1655 mixed-version rehearsal and scoped rollout

Local preparation only. No merge, production setting, provider call or hosted data change is authorized here. API a452766 and Web da3ba3d remain the published reviewed pair; this note and six characterization tests are a local follow-up. #1424 code/worktrees remain untouched.

## Verified writer entry points

| Surface | Paths/actions | Why included |
| --- | --- | --- |
| API About | PUT /api/artistBio/{id}; GET on the same path with regenerate=true | persistArtistBio writes text/history and, in the candidate, private provenance |
| API moderation/editor | PUT /api/admin/bio-corrections/{id}/about; PATCH /api/admin/bio-corrections/{id}; POST /api/directEditLink and /api/removeArtistData | Administrative About edits/moderation and artist-account identity changes |
| API agent tool transport | POST /api/mcp write-tool calls (link/mapping mutations) | Read and write tools share POST; a transport-level pause also blocks read-only tool calls and must disclose that narrower collateral effect |
| API setup | POST /api/onboarding/{artistId}/build, /chat, /reset | Starts durable claim build, publishes setup Lore/About or resets stored state |
| API research | GET and POST /api/research/advance; POST /api/artist/{id}/research/refresh, /research/questions, /research/questions/{jobId}/continue, /research/discoveries/{candidateId}/review; POST /api/artist/{id}/latest-refresh | Starts or advances stored research/source jobs; GET advance is a writer |
| API Lore inputs | POST /api/vault/upload, /sign, /complete; POST /api/artist/{id}/knowledge/sources/extract, /lore-suggestions, /link-suggestions, /bio-corrections | Source/upload and correction/discovery inputs feeding Lore; block new inputs and completion during the bounded mutation pause |
| API interview inputs | POST /api/artist/{id}/interview and its session, preparation, offer, finish, answer/boundary routes; PATCH /interview/responses/{answerId} | Stored interview evidence and preparation jobs; preserve GET status/read variants |
| Web Next server actions | claimArtistProfile; approveClaimAction/rejectClaimAction/revokeClaimAction; addVaultSource; updateSourceStatus/updateSourceType/removeVaultSource/removeVaultSources/searchWebForSources; approveSelectedLoreSources/approveContributorSubmissions/setSourcePublicationAction; correctDocClaim/undoDocCorrection; saveCurrentBio/pinBioVersionAction/deleteBioVersionAction/unpinBioAction | These are POST server actions on page URLs, not API route paths. An API-only gate misses them |
| Web other inputs | addArtist; addArtistDataAction; approveUgcAdminAction and contributor-role moderation | Can add/change artist/source activity or trigger preparation; suspend related admin/import work during the window |
| Durable execution | startClaimBuild -> claimBuildWorkflow -> buildClaimProfiles/buildClaimSources/buildClaimAbout | Workflow continues/retries after the initiating request returns; a60/120-second HTTP wait alone is not proof it drained |

The final endpoint scan also includes generic editor and MCP routes rather than assuming every writer lives under /api/artist. Agent heartbeat/run-report and API-key administration are not artist-evidence writers and are outside this freeze.

Evidence locations: API `app/api/**/route.ts`, `lib/bio/persistArtistBio.ts`, `lib/claimBuild/startClaimBuild.ts`, `claimBuildWorkflow.ts`, `lib/research/*AdvanceHandler.ts`; Web `src/app/actions/dashboardActions.ts`, `adminClaimActions.ts` and named action modules. Inventory groups dependent mutations conservatively; it is not a claim that every listed action directly writes bio. Gate predicates must be validated against actual deployed routes/action names before use.

Read-only exclusions verified in code: GET onboarding state; stored Latest/profile-updates feeds; research status/discovery/evidence reads; interview preparation GET. Health/root/login need no blanket interruption. Artist chat uses its own read/search/quota path; no reason was established to halt all #1424 local/Dev work. Do not classify every POST or GET by method alone.

## Native mixed-version results

Six new tests pass using PostgreSQL17, real0060–0064 fixture migrations and the actual new getPublicSavedBio reader:

1. Historical text/history SQL still commits, consumes an exact legacy allowance when text changes, and new public read returns null; saved bytes/history remain.
2. Same-text historical write retains the exact allowance.
3. Historical overwrite of newly evidenced text leaves the private receipt unchanged but invalidates its hash, so new public read returns null.
4. Withdrawal hides the new reader while the historical claimed raw-read query still returns the stored text.
5. An old source INSERT omitting publication/activity columns remains structurally valid; publication defaults to inherit and no contribution activity is invented.
6. The exact snapshot table-lock mode delays a concurrent old write but does not prevent it committing after release. Migration locks are not a durable writer fence.

The tests replay the SQL contract from main0f315b5a persistArtistBio/saveBioVersions and old claimed read logic. They do not execute the entire old deployment, authorization stack or provider. Full native suite:36 passed,2 browser-only skipped, plus independent route persistence/identical restart readback. No application code or migration was changed. Independent review accepted the tests and required the old-reader qualification below.

## Narrow rollout recommendation

Avoid an all-environment outage and persistent all-host allowlist. The minimum boundary is production-connected writers/workflows plus affected old raw public reads, not all traffic.

1. Before merge, obtain approval to control API promotion: current API autoAssignCustomDomains=true and main deployments are enabled; Web is already false and approval-gated. A normal API merge may promote/run the worker. Prepare production-config artifacts under a verified controlled path, keep existing aliases, and validate final merged SHAs. Do not assume a production build cannot register a cron before promotion.
2. Coordinate a brief production mutation freeze covering the entries above. Pause actual research scheduling and prevent manual GET/POST advance and new build starts. Prefer validated named route/server-action predicates. If platform action-name matching cannot be verified, a temporary production-only Next-Action POST gate is a broader fallback that must disclose blocking some read-style server actions. Leave safe GETs, login and unrelated nonproduction traffic available.
3. Drain active requests, database write transactions, research jobs and durable claim-build runs. Do not automatically cancel durable work, expire leases or rerun uncertain operations. Existing old models may be outside DB transactions, so lock acquisition alone is insufficient. If old durable runs cannot drain, defer the window or seek a separately tested compatibility fence; do not improvise one in production.
4. Preserve recovery metadata. In one bounded transaction run exact16 preflight BEFORE0060, migrations0060–0064, reviewed access-only revocations, exact16 activation and postchecks. Abort on drift. Do not rerun Dev migrations or recreate consumed allowances.
5. Switch the production API and Web to compatible artifacts while mutations remain paused. Switch or temporarily gate affected public About/raw-bio reads until both serve compatible code. The old-reader test demonstrates a privacy path even when mutation activity is zero.
6. Reconcile saved About/history and preserved16, verify role/read checks, then resume compatible workers and mutations. Targeted protection/retirement of superseded production read paths needs explicit approval; reachable old deployments or previews with production DB access are relevant even without measured traffic. Unrelated Dev-only previews need no block. Do not claim that ordinary alias promotion removes immutable URLs.

Precommit rollback restores transaction schema/ACL/data state. Postcommit retain evidence and raw-read denial; use compatible application artifacts or roll forward with affected paths gated. An old unreceipted write that already committed may have consumed an allowance: never silently restore that allowance or manufacture provenance to make text visible.

## Exact remaining decisions and evidence

Approve only the defined production promotion control, bounded mutation/worker pause and narrow old-reader handling once concrete platform predicates and active-run inventory are verified. No new infrastructure or database login is needed. The least disruptive implementation is not yet proven executable solely by this local rehearsal: live durable-run drain state and deployment-specific predicates require read-only checks at release time. Runtime head changes from #1424 require rechecking this inventory, not silently composing branches.
