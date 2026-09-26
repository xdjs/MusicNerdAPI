# MusicNerdAPI — Agent Guide

The Music Nerd API: the endpoints behind [Music Nerd](https://github.com/xdjs/MusicNerdWeb), MNTV and other clients. Next.js 16 App Router, **API routes only**. The one page (`app/page.tsx`) tells a browser visitor this is an API and links to the docs. Split out of MusicNerdWeb at the 2026-09-25 standup; the architecture follows Recoup's API.

Issues and trackers live in [xdjs/MusicNerdWeb](https://github.com/xdjs/MusicNerdWeb/issues). Link PRs here by full ref (`xdjs/MusicNerdWeb#1347`).

## Docs first

Every endpoint is documented before it is built (2026-09-25 standup):

1. **Docs PR** in the docs codebase: the endpoint's page (request, response, errors, auth).
2. **API PR** here: code that meets the page, test first.
3. **Client PR:** in whichever app uses it.

The docs don't live in this repo. Document only what the code will actually do; when behaviour changes, update the doc too.

## Layout

| Path | What lives there |
| --- | --- |
| `app/api/<route>/route.ts` | Thin route files: JSDoc, `OPTIONS` preflight, then delegate to a handler |
| `lib/<domain>/` | Business logic by domain: handlers (`get<Name>Handler`), `validate<Name>Body` / `validate<Name>Query` (Zod) |
| `lib/networking/` | Shared HTTP helpers (`getCorsHeaders`) |

## Code principles

- **One exported function per file**, named after the file, with a test beside it in `__tests__/`. A constants or types module is the one exception.
- **TDD:** write the test, run it and **see it fail**, then write the minimum code to pass, then refactor.
- **Flat responses:** `{ "status": "ok", ... }`, never a `data` wrapper. Errors: `{ "status": "error", "error": "<message>" }`.
- **Validate input** with a `validate<Name>Body` / `validate<Name>Query` function that returns the parsed value or a 400 `NextResponse`.
- **JSDoc on every route**, enforced by ESLint for `app/api/**`.
- **Terminology:** "artist", "account". Never take an account ID from a request body; derive it from authentication.
- **No proactive code:** don't add config, env vars, dependencies or abstractions until an endpoint needs them. Name the case first.

## Commands

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # vitest
pnpm type-check     # tsc, tests included
pnpm lint:check     # eslint
pnpm format:check   # prettier
pnpm build
```

CI runs all of these on every PR (`.github/workflows/ci.yml`).

## Git and releases

- Branch from `main`, open a PR to `main`, squash merge. Code branches are `<contributor>/<slug>`, docs-only branches may be `docs/<slug>`. Use conventional commits.
- Never merge without the owner's say-so.
- **The repo is public.** No secrets, tokens, emails or database refs in code, issues, PRs or docs. Env var names only (`.env.example`).
- **Domain:** `api.musicnerd.xyz` still serves MusicNerdWeb's endpoints, and SleeveNote and others call them. Don't point it here until every endpoint it serves has been ported (2026-09-25 standup).
