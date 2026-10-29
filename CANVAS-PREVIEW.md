# Conversation-driven canvas preview

Branch-only extension to the existing artist chat route. Optional canvas.v1 requests use the existing MODEL_CHAT, instructions and stored-source search/read tools, adding a typed composeCanvas tool. Ordinary chat requests retain existing behavior. LATASHA and Dutchyyy staging IDs are allowlisted. No arbitrary generated code or model-owned source URLs.

The complete next spec is validated against server-owned evidence and pinned blocks. A successful turn emits data-canvas after the stream finishes. Failed or aborted turns cannot commit a candidate. Clients verify session, turn and revision before committing.

## Budget and environment

Disabled unless VERCEL_ENV=preview and MUSICNERD_CANVAS_PREVIEW_ENABLED=1. Reject known production Supabase project. Inherited preview database only; existing visitor/global question quota retained. An advisory-lock transaction admits at most 18 shared reservations across all instances using existing artist_activity_events. No table migration. Reservations are never refunded, including failed calls. Window closes 2026-10-29 16:00 UTC.

Each reservation conservatively holds $1: four maximum model steps; max 2,048 output tokens per step; no SDK retries; 40,000 UTF-8 bytes for instructions/messages per step, plus allowance of 10,000 input tokens for authored tool schemas/framing; no paid web-search tool in canvas mode. At verified Gateway regional worst-case input/cache-write $2.75/M and output $11/M on 2026-10-29, that upper bound is $0.641. $18 reservations leave $2 headroom under the user's $20 total. Existing chat model remains anthropic/claude-sonnet-5.5. No credential or provider changes. Usage logs contain turn ID, model, input/output counts and conservative cost, never prompts or source contents. Budget cannot be extended by resetting a session or deploying a new instance.

Seed evidence is a curated public-source snapshot. Dutchyyy PDFs were downloaded from his public Music Nerd Lore profile and selected pages visually checked. PDF page links distinguish artist preface, discography document claims, release dates and recording periods. Source counts do not prove staging extraction completeness. Existing readSource can add stored public originals, without invented quotes or event dates. Canvas selection must not imply causation.
