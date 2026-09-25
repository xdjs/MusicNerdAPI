# GET /api/health

Confirms the API is up. It does no work and reads nothing, so it is safe to poll.

## Request

No parameters, no authentication.

## Response

`200 OK`

```json
{ "status": "ok" }
```

## Preflight

`OPTIONS /api/health` returns `200` with the CORS headers and an empty body.
