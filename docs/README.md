# Music Nerd API docs

The API is built **docs first**. Each endpoint is written up here before any code is written for it:

1. A docs PR adds or changes the endpoint's page under `docs/endpoints/`.
2. An API PR implements that page, test first.
3. A client PR (Music Nerd web, MNTV, the Discord bot) uses it.

Decided at the 2026-09-25 standup. The docs are Markdown for now; a hosted docs site comes later.

## Endpoints

| Method | Path          | Page                          |
| ------ | ------------- | ----------------------------- |
| GET    | `/api/health` | [health](endpoints/health.md) |

## Conventions

- **Flat responses.** Fields sit at the root, not inside a `data` wrapper: `{ "status": "ok" }`.
- **Errors** are `{ "status": "error", "error": "<message>" }` with a 4xx or 5xx code.
- **CORS** is open (`*`) on every `/api/*` route, with an `OPTIONS` preflight.
