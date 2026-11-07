# #1655 local draft review handoff — 2026-11-05

No PR has been published. The original isolated checkpoints remain intact. Fetching current main and preparing these worktrees changed no shared deployment or database.

| Repository | Fetched main | Original checkpoint | Review branch / base candidate |
| --- | --- | --- | --- |
| API | `4f7c2705bde7545c53270fbd732d804aa5d7ca77` | `9cb9bf18c5919714fa91682ffc3958932767abbb` | `codex/1655-api-review-20261105`, same application/test tree |
| Web | `03b2d9a556644d4ec7121fca398977057ad8c90f` | `6fb80c491ed87870ea6e2832153c1a996127508d` | `codex/1655-web-review-20261105`, merge `71b7c46ef19bb1d095fab79ceee2bea499f41454` |

API main has no unseen commits. Web main contained three meeting-documentation commits. They merged cleanly; `git diff` confirms no change to src, migrations, drizzle config, package manifest or lockfile against the tested checkpoint. No application tests were rerun merely for that documentation merge. Prior evidence remains: 27 native PostgreSQL17 tests; 186 Web tests, types/lint; successful real-login hosted synthetic API acceptance. Full production builds on the final publication candidates remain required.

Draft bodies: [API](1655-api-draft.md), [Web](1655-web-draft.md). A matching Web-local copy lives in that review branch at `docs/review/1655-draft.md`. These are coordinated integration drafts, not a claim that the accumulated patch is a tiny endpoint change. Compared with main, the candidate includes source eligibility, independent trusted uploads/revocation fencing, About orchestration, private history/receipts, legacy exceptions, reader changes, onboarding preservation and extensive verification artifacts. Review those as explicit dependency sections; do not silently omit their impact from published descriptions. The guarded raw-reader cutover is still a prototype, not an approved target migration.

## Minimum durable rehearsal

Use the existing Vercel project and two already verified Privy test identities. Use one dedicated PostgreSQL17 database, one synthetic artist reset only BETWEEN cases, and a second artist only for the shared-receipt race. Bootstrap/seed are operator setup, never request behavior. Request A writes; request B on a different app connection/instance reads the same committed state without reset. Then exercise the actual Web regeneration and setup flow with all search/extraction/social/background boundaries replaced by deterministic test adapters. No real model calls or copied customer records are needed.

Machine-readable evidence template: `1655-durable-run.template.json`. It is intentionally NOT an execution manifest: target, approval and fixture IDs are unset. The full acceptance/cutover/rollback plan remains [here](../about-1655-acceptance-after-hosted.md).

The connected XDJS project inventory was rechecked: Music Nerd, Music Nerd Dev, MNTV, Between Sets and Roomtone. None is identified or authorized as this disposable test target. This is not proof that another account has no suitable target. Do not repurpose another application's project or shared Dev by inference.

Smallest outstanding decision: name an existing disposable target, or authorize one short-lived test database in the existing organization, its limited test credential, synthetic fixture setup and cleanup. Proposed lifetime is at most24 hours; no new Vercel project or Privy app. Creation requires the account-specific quote and explicit cost confirmation first. No cost confirmation or provisioning has occurred.

Current public Micro compute pricing is $0.01344/hour (~$10/month if retained), so24 hours is $0.32256 compute before credits/taxes/other usage. This is not an all-in quote or hard cap. Hours round up; charges continue if cleanup fails. Existing preview/auth usage can contribute other charges. [Official compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute), checked2026-11-05. Do not purchase add-ons or change shared security settings.

Production still separately requires real reader/role ownership, reviewed incremental migrations, exact16 snapshot activation, a coordinated traffic/worker gate and guarded rollback. Those decisions do not block local draft review, but the synthetic rehearsal cannot waive them.
