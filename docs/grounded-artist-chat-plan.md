# Grounded Artist Chat Implementation Plan (part 1: chat on passages)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace whole-file PDF reads and the in-memory corpus search with a page-level unit index and hybrid retrieval, so the artist chat answers from passages with locator citations, behind a flag, measured by a retrieval eval before the switch.

**Architecture:** One additive migration in the Web repo adds `source_units` (tsvector + GIN, pgvector + HNSW). The API grows a `lib/units/` package: ingest (page extraction, sectioning, vision fallback, embeddings, atomic write), a `unit_sync` research job for backfill and catch-up, and hybrid search (full-text and vector candidates fused by reciprocal rank). The chat gets `searchPassages`, `readUnits` and `listDocuments` tools, a per-conversation document registry that carries citation numbers across turns, and one batched revalidation per step. The native PDF read is removed once the flag flips.

**Tech Stack:** Next.js API on Vercel, `postgres` + drizzle, Supabase Postgres with pgvector, Vercel AI SDK 7 (`embedMany`, `generateText`, `streamText`) through the Vercel AI Gateway, `pdf-parse` 1.1.4, `pdf-lib` (new), Vitest with PGlite for SQL tests, Braintrust evals.

**Spec:** `docs/grounded-artist-chat-design.md` (approved 2026-11-13). This plan covers migration steps 1 to 6 of the spec. The partner endpoints (step 7) and the Web retirements table are separate plans, written after the chat has run on passages for a release.

## Global Constraints

- Both repositories are public: no secrets, tokens or database references in code, PRs or docs; env var names only. Passages and unit text are never printed in CI or Actions logs, and never in eval output.
- `extracted_text` is never rewritten, with one exception: a vault source whose `extracted_text` is null gets the vision pass text written once.
- Eligibility is joined at query time from the source's publication state and revision; nothing about eligibility is stored in a unit.
- The migration lands once, in the Web repo (`drizzle/0044_source_units.sql` + `drizzle/meta/_journal.json`, idx 44), and both schema files are updated. It is applied by hand per environment before dependent code deploys, per `docs/development.md#database-migrations` in the Web repo; `npx drizzle-kit check` must pass; `db:migrate` is not wired into deploys.
- The app role is `mnweb`: every new table ships with RLS enabled, four permissive `mnweb_*` policies, `REVOKE ALL ... FROM PUBLIC, anon, authenticated, mnweb` then explicit `GRANT`.
- Every model call is a gateway string id. Models: chat `MODEL_CHAT` (`anthropic/claude-sonnet-5.5`), judge `MODEL_JUDGE` (`openai/gpt-5.4`), embeddings `openai/text-embedding-3-small` (1536 dimensions), vision pass `google/gemini-3.8-flash`.
- Budgets per answer: 12,000 tokens of retrieved text, 6 steps, 1,500 output tokens, 2 web searches. Ingest: 300 pages per document, 10 MB upload limit unchanged, 40 pages inline at upload (more goes to the queue).
- API repo rules (`AGENTS.md`): one exported function per file, named after the file, test beside it in `__tests__/`; TDD (see the test fail first); conventional commits; no env vars, dependencies or abstractions before the task that needs them; docs PR first for any public contract change.
- Base branch for API work: `claude/1424-chat-followup-history` (API #118, stacked on #117), which carries the page-marked PDF renderer, the eval gates, `MODEL_JUDGE` and `keepCurrentPdfTurns`. #117 and #118 merge before part 1's chat PRs.
- Staging allowance stays 30 questions per visitor-hour and 200 per day; evals wait for it, never raise it.

## Review Focus

1. A document withdrawn between `searchPassages` and `readUnits`: the read must return "Source changed or is no longer public", never the text (Task 16).
2. A document reprocessed mid-conversation (new revision): the earlier turn that cited it is dropped from history and a later step fails closed instead of answering from stale units (Task 17).
3. A PDF whose every page is empty and whose vision pass fails: the upload still completes, zero units are written, the failure is recorded in the ingest outcome (Tasks 10, 11).
4. A question made of stopwords or an empty string: full-text search returns no rows and no SQL error (Task 13).
5. The embedding call failing at upload time: units are written without embeddings, full-text search still finds them, and `unit_sync` fills the embeddings later (Tasks 10, 12).

---

## PR map

| PR | Repo | Branch (from) | Tasks |
| --- | --- | --- | --- |
| W1 | Web | `claude/0044-source-units` (main) | 1 |
| A1 | API | `claude/units-ingest` (#118 head) | 2 to 12 |
| A2 | API | `claude/units-retrieval` (A1) | 13, 14, 21 |
| A3 | API | `claude/units-chat` (A2) | 15 to 19 |
| A4 + W2 + D1 | API, Web, Docs | `claude/units-switch` (A3), `claude/chat-passages-labels`, docs branch | 20 |

Migration W1 is applied to staging before A1 is exercised there, and to production before A1 deploys (API main auto-publishes on merge).

---

### Task 1: Migration `0044_source_units` (Web)

**Files:**
- Create: `drizzle/0044_source_units.sql`
- Modify: `drizzle/meta/_journal.json` (append idx 44, tag `0044_source_units`, version `"7"`, `breakpoints: true`)
- Modify: `src/server/db/schema.ts` (add `sourceUnits`; widen nothing else)
- Test: `npx drizzle-kit check`, `npm test`

**Interfaces:**
- Produces: table `public.source_units` with columns `id uuid pk default extensions.uuid_generate_v4()`, `source_kind text check in ('vault','social','evidence')`, `source_id uuid`, `artist_id uuid references artists(id) on delete cascade`, `source_revision text`, `unit_index integer`, `locator text`, `title text null`, `url text null`, `text text`, `text_hash text`, `tokens integer`, `ocr boolean default false`, `ingest_version integer`, `search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || text)) stored`, `embedding extensions.vector(1536) null`, `created_at timestamptz default (now() at time zone 'utc')`; unique `(source_kind, source_id, unit_index)`; indexes `source_units_artist btree (artist_id, source_kind, source_id)`, `source_units_search gin (search)`, `source_units_embedding hnsw (embedding extensions.vector_cosine_ops)`. Job kind `unit_sync` allowed by `artist_research_jobs_kind_check`.

- [ ] **Step 1: Write the migration**

Header comment: "Page-level source units for grounded chat; additive. Apply before MusicNerdAPI `unit_sync` deploys." Then, in one transaction with `SET LOCAL lock_timeout = '5s'`, separated by `--> statement-breakpoint`: `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;` (the `extensions` schema, so the Supabase lint `0014_extension_in_public` does not fire), the table and indexes above, `ALTER TABLE source_units ENABLE ROW LEVEL SECURITY`, the four `mnweb_{select,insert,update,delete}_source_units` policies with `USING (true)` / `WITH CHECK (true)`, `REVOKE ALL ON public.source_units FROM PUBLIC, anon, authenticated, mnweb`, `GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_units TO mnweb`, then `ALTER TABLE artist_research_jobs DROP CONSTRAINT artist_research_jobs_kind_check` and re-add it with the existing ten kinds plus `'unit_sync'` (copy the current list from `drizzle/0040_question_research.sql` and later migrations; do not retype from memory).

- [ ] **Step 2: Mirror the table in `src/server/db/schema.ts`**

`export const sourceUnits = pgTable("source_units", {...})` with `vector("embedding", { dimensions: 1536 })` from `drizzle-orm/pg-core`, a `customType` for `tsvector` with `.generatedAlwaysAs(sql\`...\`)`, the unique index, the three indexes, `pgPolicy` entries for `mnweb`, and `.enableRLS()`, following `artistResearchCandidates` in the same file.

- [ ] **Step 3: Append the journal entry and check**

Run: `npx drizzle-kit check`
Expected: no error. (If `check` reports snapshot drift that predates this change, note it in the PR and do not regenerate older snapshots.)

- [ ] **Step 4: Run the Web suite**

Run: `npm test`
Expected: PASS (the schema is mocked; this guards the TypeScript of the new table).

- [ ] **Step 5: Commit and open the PR as draft**

```bash
git add drizzle/0044_source_units.sql drizzle/meta/_journal.json src/server/db/schema.ts
git commit -m "feat(db): source_units table for page-level chat retrieval (0044)"
```

PR body states: applied to nowhere yet; apply to staging by hand per the migration protocol before API PR A1 is exercised there.

---

### Task 2: API schema mirror and unit constants

**Files:**
- Modify: `lib/db/schema.ts` (add `sourceUnits`, columns the API uses; no policies, per the file header)
- Create: `lib/units/types.ts`
- Modify: `lib/ai/const.ts` (add `MODEL_EMBEDDING`, `MODEL_OCR`)

**Interfaces:**
- Produces (`lib/units/types.ts`):
  - `export type UnitSourceKind = "vault" | "social" | "evidence";`
  - `export type UnitBody = { kind: "pdf"; bytes: Uint8Array } | { kind: "markdown" | "plain"; text: string } | { kind: "none" };`
  - `export type UnitSourceInput = { sourceKind: UnitSourceKind; sourceId: string; artistId: string; title: string | null; url: string | null; sourceRevision: string; extractedTextIsNull: boolean; body: UnitBody };`
  - `export type UnitDraft = { unitIndex: number; locator: string; text: string; textHash: string; tokens: number; ocr: boolean };`
  - `export type UnitHit = { sourceKind: UnitSourceKind; sourceId: string; sourceRevision: string; unitIndex: number; locator: string; title: string | null; url: string | null; text: string; score: number };`
  - `export type IngestOutcome = { units: number; ocrPages: number; embedded: boolean; skipped?: "not-found" | "no-text" | "too-large"; failed?: "vision" | "extract" };`
  - Constants: `UNIT_INGEST_VERSION = 1`, `EMBEDDING_DIMENSIONS = 1536`, `EMBED_BATCH = 64`, `MAX_INGEST_PAGES = 300`, `INLINE_INGEST_MAX_PAGES = 40`, `MAX_UNIT_CHARS = 6000`, `MAX_PAGE_CHARS = 24000`, `SEARCH_CANDIDATES = 20`, `SEARCH_LIMIT = 8`, `MAX_UNITS_PER_DOCUMENT = 3`, `RRF_K = 60`, `PASSAGE_CHARS = 1200`, `READ_UNITS_TOKEN_BUDGET = 12000`, `WEAK_COSINE_DISTANCE = 0.6`.
- Produces (`lib/ai/const.ts`): `export const MODEL_EMBEDDING = "openai/text-embedding-3-small";` and `export const MODEL_OCR = "google/gemini-3.8-flash";` with one-line comments naming the gateway list price date (2026-11-13).

- [ ] **Step 1: Add the schema mirror, types and constants** (a constants or types module is exempt from the one-function rule)
- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts lib/units/types.ts lib/ai/const.ts
git commit -m "feat(units): schema mirror, unit types and model constants"
```

---

### Task 3: `extractPdfPages`

**Files:**
- Create: `lib/units/extractPdfPages.ts`, `lib/units/__tests__/extractPdfPages.test.ts`
- Modify: `lib/evals/readPdfChatEvidence.ts:14-26` (import the shared renderer instead of its private copy)
- Modify: `package.json` (add `pdf-lib`, used by the tests here and by Task 5)

**Interfaces:**
- Produces: `export async function extractPdfPages(bytes: Uint8Array, opts?: { timeoutMs?: number; maxPages?: number }): Promise<{ pages: string[]; truncated: boolean }>` — `pages[i]` is the text of physical page `i + 1`, trimmed, newline on y-change exactly as `readPdfChatEvidence.renderPage` does today; `truncated` is true when the document has more than `maxPages` (default `MAX_INGEST_PAGES`); the parse is raced against `timeoutMs` (default `PDF_PARSE_TIMEOUT_MS` from `lib/vaultUpload/const.ts`) and rejects on timeout.

- [ ] **Step 1: Write the failing tests**

```ts
test("returns one entry per physical page in order", async () => {
  const bytes = await twoPagePdf(["Alpha one", "Beta two"]); // helper built with pdf-lib in the test file
  const result = await extractPdfPages(bytes);
  expect(result.pages).toHaveLength(2);
  expect(result.pages[0]).toContain("Alpha one");
  expect(result.pages[1]).toContain("Beta two");
  expect(result.truncated).toBe(false);
});
test("stops at maxPages and reports truncation", async () => {
  const bytes = await twoPagePdf(["A", "B"]);
  const result = await extractPdfPages(bytes, { maxPages: 1 });
  expect(result.pages).toHaveLength(1);
  expect(result.truncated).toBe(true);
});
test("rejects when the parse exceeds the timeout", async () => {
  await expect(extractPdfPages(await twoPagePdf(["A"]), { timeoutMs: 0 })).rejects.toThrow(/timed out/i);
});
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run lib/units/__tests__/extractPdfPages.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement** with `pdf-parse/lib/pdf-parse.js` and a `pagerender` that returns the page text; collect per page by index (`max: maxPages`); do not join pages into one string.
- [ ] **Step 4: Run the tests and the existing `readPdfChatEvidence` tests**

Run: `pnpm vitest run lib/units lib/evals/__tests__/readPdfChatEvidence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml lib/units/extractPdfPages.ts lib/units/__tests__/extractPdfPages.test.ts lib/evals/readPdfChatEvidence.ts
git commit -m "feat(units): per-page PDF text extraction shared with the eval"
```

---

### Task 4: `splitTextUnits` and `isBrokenExtraction`

**Files:**
- Create: `lib/units/splitTextUnits.ts`, `lib/units/__tests__/splitTextUnits.test.ts`
- Create: `lib/units/isBrokenExtraction.ts`, `lib/units/__tests__/isBrokenExtraction.test.ts`

**Interfaces:**
- Produces: `export function splitTextUnits(text: string, kind: "markdown" | "plain", maxChars = MAX_UNIT_CHARS): { locator: string; text: string }[]`. Markdown: split at `#`-headings; locator is `§` + heading text (the nearest heading above; `§Top` before the first heading); a section longer than `maxChars` splits at paragraph breaks and its later parts get ` (2)`, ` (3)` appended. Plain: paragraphs grouped up to `maxChars`; locator `¶N` where N is the 1-based index of the first paragraph in the group. Empty input returns `[]`.
- Produces: `export function isBrokenExtraction(text: string): boolean` — true when fewer than 40 word characters, or the mean token length over whitespace-separated tokens exceeds 20, or more than 30% of non-space characters are outside letters, digits and common punctuation.

- [ ] **Step 1: Write the failing tests**

```ts
test("markdown splits at headings with § locators", () => {
  const units = splitTextUnits("Intro\n\n## Early years\nBorn in 1970.\n\n## Career\nSigned in 1990.", "markdown");
  expect(units.map(u => u.locator)).toEqual(["§Top", "§Early years", "§Career"]);
});
test("long sections split at paragraphs and number their parts", () => {
  const units = splitTextUnits("## A\n" + "para\n\n".repeat(50), "markdown", 100);
  expect(units[0].locator).toBe("§A");
  expect(units[1].locator).toBe("§A (2)");
  expect(units.every(u => u.text.length <= 100)).toBe(true);
});
test("plain text uses paragraph locators", () => {
  expect(splitTextUnits("one\n\ntwo\n\nthree", "plain", 8).map(u => u.locator)).toEqual(["¶1", "¶2", "¶3"]);
});
test("empty input yields no units", () => { expect(splitTextUnits("   ", "plain")).toEqual([]); });

test("near-empty text is broken", () => { expect(isBrokenExtraction("p. 3")).toBe(true); });
test("fused words are broken", () => { expect(isBrokenExtraction("thequickbrownfoxjumpsoverthelazydogagainandagain ".repeat(5))).toBe(true); });
test("ordinary prose is not broken", () => { expect(isBrokenExtraction("The quick brown fox jumps over the lazy dog. ".repeat(5))).toBe(false); });
```

- [ ] **Step 2: Run, see them fail. Step 3: Implement. Step 4: Run, see them pass.**

Run: `pnpm vitest run lib/units`

- [ ] **Step 5: Commit** — `feat(units): section splitting and broken-extraction detection`

---

### Task 5: `slicePdfPage` and `readPageWithVision`

**Files:**
- Create: `lib/units/slicePdfPage.ts`, `lib/units/__tests__/slicePdfPage.test.ts`
- Create: `lib/units/readPageWithVision.ts`, `lib/units/__tests__/readPageWithVision.test.ts`
- Modify: `lib/ai/generateText.ts:7-25` (`prompt: string | ModelMessage[]`, the way `lib/ai/streamText.ts:14-27` already allows) and its test

**Interfaces:**
- Produces: `export async function slicePdfPage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array>` — a new one-page PDF containing page `pageIndex` (0-based), via `pdf-lib` `PDFDocument.copyPages`.
- Produces: `export async function readPageWithVision(pageBytes: Uint8Array, opts?: { signal?: AbortSignal; model?: string }): Promise<string>` — one `generateText` call to `MODEL_OCR` with a user message of one `file` part (`mediaType: "application/pdf"`) and the text "Transcribe every word on this page as markdown. Keep headings, lists and tables. Return only the transcription." Returns the trimmed text; throws on an empty result.

- [ ] **Step 1: Failing tests**

```ts
test("slicePdfPage returns a one-page PDF with that page's text", async () => {
  const sliced = await slicePdfPage(await twoPagePdf(["First", "Second"]), 1);
  expect((await extractPdfPages(sliced)).pages).toEqual([expect.stringContaining("Second")]);
});
test("readPageWithVision sends the page as a file part and returns the text", async () => {
  generateTextMock.mockResolvedValue({ text: "## Title\nBody" });
  await expect(readPageWithVision(new Uint8Array([37, 80, 68, 70]))).resolves.toBe("## Title\nBody");
  const call = generateTextMock.mock.calls[0][0];
  expect(call.model).toBe(MODEL_OCR);
  expect(call.prompt[0].content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "file", mediaType: "application/pdf" })]));
});
test("readPageWithVision rejects an empty transcription", async () => {
  generateTextMock.mockResolvedValue({ text: "  " });
  await expect(readPageWithVision(new Uint8Array([1]))).rejects.toThrow(/empty/i);
});
```

- [ ] **Step 2: Run, fail. Step 3: Implement (mock `@/lib/ai/generateText` in the test). Step 4: Run, pass.**
- [ ] **Step 5: Commit** — `feat(units): one-page PDF slices read by the vision model`

---

### Task 6: `embedUnits`

**Files:**
- Create: `lib/units/embedUnits.ts`, `lib/units/__tests__/embedUnits.test.ts`

**Interfaces:**
- Produces: `export async function embedUnits(texts: string[], opts?: { signal?: AbortSignal }): Promise<number[][]>` — `embedMany({ model: MODEL_EMBEDDING, values })` from `ai`, in batches of `EMBED_BATCH`, preserving order; throws if any returned vector is not `EMBEDDING_DIMENSIONS` long; returns `[]` for `[]` without calling the model.

- [ ] **Step 1: Failing tests** (mock `ai`'s `embedMany`): order preserved across two batches of 64 + 1; dimension mismatch throws; empty input makes no call.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**
- [ ] **Step 5: Commit** — `feat(units): batched embeddings through the gateway`

---

### Task 7: `buildSourceUnits`

**Files:**
- Create: `lib/units/buildSourceUnits.ts`, `lib/units/__tests__/buildSourceUnits.test.ts`

**Interfaces:**
- Consumes: `extractPdfPages`, `splitTextUnits`, `isBrokenExtraction`, `slicePdfPage`, `readPageWithVision`.
- Produces: `export async function buildSourceUnits(input: UnitSourceInput, deps?: { readPage?: (pageBytes: Uint8Array) => Promise<string>; signal?: AbortSignal }): Promise<{ units: UnitDraft[]; ocrPages: number; failed?: "vision" | "extract"; truncated: boolean }>`. PDF: one unit per page, locator `p.N`; a page whose text `isBrokenExtraction` goes through `slicePdfPage` + `readPage` (default `readPageWithVision`) and gets `ocr: true`; if the vision call throws for a page, that page is skipped and `failed: "vision"` is set; a page over `MAX_PAGE_CHARS` is cut there. Markdown/plain: `splitTextUnits`. `none`: `units: []`. `textHash` is sha256 hex of the unit text; `tokens` is `Math.ceil(text.length / 4)`.

- [ ] **Step 1: Failing tests**

```ts
test("pdf pages become p.N units", ...)            // two-page fixture → locators ["p.1","p.2"], ocr false
test("an empty page is read by the vision pass", ...) // page 2 blank → readPage called once, unit 2 has ocr true and its text
test("a vision failure skips the page and reports it", ...) // readPage rejects → units length 1, failed "vision"
test("markdown bodies use section locators", ...)
test("hash and token count are set", ...)           // sha256 of the text, ceil(len/4)
```

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(units): build unit drafts from a source body`

---

### Task 8: `vaultSourceRevisionSql` and `writeSourceUnits`

**Files:**
- Create: `lib/sourcePublication/vaultSourceRevisionSql.ts` + test; Modify: `lib/chatPdf/loadChatPdfs.ts:38` to use it
- Create: `lib/units/writeSourceUnits.ts`, `lib/units/__tests__/writeSourceUnits.integration.test.ts` (PGlite, pattern of `lib/questionResearch/__tests__/preClaimOriginals.integration.test.ts`)

**Interfaces:**
- Produces: `export function vaultSourceRevisionSql(alias = "v")` returning the drizzle `sql` fragment `coalesce(v.updated_at, v.created_at)::text || ':' || md5(coalesce(v.extracted_text, '')) || ':' || v.publication` (exactly the #118 formula, now in one place).
- Produces: `export async function writeSourceUnits(tx: WriteDb, input: { sourceKind: UnitSourceKind; sourceId: string; artistId: string; sourceRevision: string; title: string | null; url: string | null; units: UnitDraft[]; embeddings: number[][] | null }): Promise<number>` — deletes every row for `(sourceKind, sourceId)` and inserts the new rows in the same transaction; `embeddings[i]` is written as `'[...]'::extensions.vector` when present, else null; returns the number of rows written.

- [ ] **Step 1: Failing tests.** In PGlite create `source_units` with `embedding text` (PGlite 0.5.8 has no pgvector; the cast is exercised by Task 21's real-Postgres test) and a `vector` domain over text so `::extensions.vector` parses: `create schema extensions; create domain extensions.vector as text;`.

```ts
test("writes one row per unit with the generated search column", ...)  // 2 units → 2 rows, search not null, embedding null
test("replaces rows for the same source atomically", ...)              // write 3, then 1 → 1 row remains, unit_index 0
test("stores embeddings as vector literals", ...)                      // embedding column equals "[0.1,0.2]"
```

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass (`pnpm vitest run lib/units lib/chatPdf lib/sourcePublication`).**
- [ ] **Step 5: Commit** — `feat(units): atomic unit writes; one vault revision formula`

---

### Task 9: `loadUnitSource`

**Files:**
- Create: `lib/units/loadUnitSource.ts`, `lib/units/__tests__/loadUnitSource.integration.test.ts`
- Create: `lib/sourcePublication/socialPostRevisionSql.ts` + test (`public.knowledge_source_fingerprint(public.knowledge_social_post_snapshot(s))`, the 0039 fingerprint; PGlite tests stub both functions as `preClaimOriginals.integration.test.ts` does)

**Interfaces:**
- Produces: `export async function loadUnitSource(ref: { sourceKind: UnitSourceKind; sourceId: string }, opts?: { bytes?: Uint8Array; signal?: AbortSignal }): Promise<UnitSourceInput | null>`.
  - `vault`: row by id (any status; eligibility is a query-time concern). `content_type = 'application/pdf'` → body `pdf` from `opts.bytes` or a fetch of `url` (`AbortSignal.timeout(10_000)`, reject bodies over `MAX_VAULT_FILE_BYTES` or not starting with `%PDF-`, reusing the checks in `lib/chatPdf/readChatPdf.ts`); `text/markdown` → `markdown`; other text types and web pages (`file_path is null`) → `plain` from `extracted_text`; null text and not a PDF → `none`. `sourceRevision` from `vaultSourceRevisionSql`; `extractedTextIsNull` from the row.
  - `social`: own post only (`is_own_post = true`, not a repost); text = caption + "\n\n" + transcript when present; body `plain`; locator handled by `buildSourceUnits` as `¶1`; revision from `socialPostRevisionSql`.
  - `evidence`: `artist_research_evidence` row joined to its candidate; body `plain` from `original_text`; revision `e.revision`; title `e.title`; url `c.url`.
  - Missing row → `null`.

- [ ] **Step 1: Failing tests** (PGlite tables with the columns used; `fetch` mocked for the PDF case): vault PDF with bytes supplied; vault PDF fetched; vault markdown; vault web page; social post with transcript; evidence; missing row → null; oversized fetch rejected.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(units): load a unit source of any kind with its revision`

---

### Task 10: `ingestSource`

**Files:**
- Create: `lib/units/ingestSource.ts`, `lib/units/__tests__/ingestSource.test.ts`

**Interfaces:**
- Consumes: `loadUnitSource`, `buildSourceUnits`, `embedUnits`, `writeSourceUnits`, `db.transaction`.
- Produces: `export async function ingestSource(ref: { sourceKind: UnitSourceKind; sourceId: string }, opts?: { bytes?: Uint8Array; signal?: AbortSignal; embed?: boolean }): Promise<IngestOutcome>`. Order: load (null → `skipped: "not-found"`), build (`none` or zero units → `skipped: "no-text"`, writes nothing and deletes stale rows for the source), embed (`embed !== false`; an embedding failure is caught: `embedded: false`, units still written with null embeddings), write in one transaction. When the source is a vault row with `extractedTextIsNull` and the build produced OCR text, update `artist_vault_sources.extracted_text` to the joined page texts in the same transaction, once (the one allowed write to that column). Never throws for a vision or embedding failure; throws for database errors.

- [ ] **Step 1: Failing tests** (mock the four collaborators and `@/lib/db/db`):

```ts
test("writes units and embeddings for a text-layer PDF", ...)           // outcome { units: 2, ocrPages: 0, embedded: true }
test("writes units without embeddings when embedding fails", ...)       // embedUnits rejects → embedded false, writeSourceUnits called with embeddings null
test("an all-empty PDF whose vision pass fails writes nothing and does not throw", ...) // { units: 0, failed: "vision" }
test("fills a null extracted_text once from OCR text", ...)             // update statement issued once; not issued when extracted_text is present
test("a missing source is reported as skipped", ...)
```

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(units): ingest one source into units`

---

### Task 11: Ingest at upload

**Files:**
- Modify: `lib/vaultUpload/postCompleteUploadHandler.ts:101-132`, `lib/vaultUpload/completeIndependentLoreUpload.ts:46-51`, `lib/vaultUpload/postUploadHandler.ts:138-170` and their tests
- Create: `lib/units/queueUnitSync.ts` + test (pattern of `lib/research/queueLoreRefresh.ts`)
- Create: `lib/units/ingestUploadInline.ts` + test

**Interfaces:**
- Produces: `export async function queueUnitSync(artistId: string, writer?: TransactionDb): Promise<boolean>` — inserts a pending `unit_sync` job for the artist, `on conflict do nothing` against `artist_research_jobs_one_live`.
- Produces: `export async function ingestUploadInline(input: { sourceId: string; artistId: string; bytes: Buffer; contentType: string }): Promise<void>` — PDFs with `numpages <= INLINE_INGEST_MAX_PAGES` (count via `lib/chatPdf/inspectChatPdf.ts` until Task 20 removes it; afterwards `extractPdfPages` with `maxPages`) and text uploads call `ingestSource` with the bytes; anything larger, and any thrown error, falls back to `queueUnitSync`. Never rejects.

- [ ] **Step 1: Failing tests:** each of the three handlers calls `ingestUploadInline` after the vault row is written and still returns its success response when `ingestUploadInline` rejects (it must not); a 41-page PDF queues `unit_sync` and does not ingest inline; an `ingestSource` database error queues `unit_sync`.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run the three handler suites and `lib/units`, pass. Step 5: Commit** — `feat(units): index uploads inline, queue the rest`

---

### Task 12: `unit_sync` job and backfill

**Files:**
- Modify: `lib/research/types.ts:1-11` (`JobKind` gains `"unit_sync"`), `lib/research/const.ts:9-20` (`PORTED_JOB_KINDS`), `lib/research/runResearchJob.ts:21-42` (case)
- Create: `lib/units/runUnitSync.ts`, `lib/units/__tests__/runUnitSync.test.ts`
- Create: `lib/units/listArtistUnitSources.ts`, `lib/units/__tests__/listArtistUnitSources.integration.test.ts`
- Modify: `README.md` (one line: Web migration 0044 must be applied before this job runs; the backfill is one manual SQL insert, text given in the PR body, no secrets)

**Interfaces:**
- Produces: `export async function listArtistUnitSources(artistId: string): Promise<{ sourceKind: UnitSourceKind; sourceId: string; sourceRevision: string; indexedRevision: string | null; needsEmbedding: boolean }[]>` — every vault source with text or PDF bytes, own non-repost social post and confirmed evidence row of the artist, left-joined to `source_units` (distinct source revision, and whether any unit has a null embedding); plus orphan units whose source row is gone (`sourceRevision` null for those).
- Produces: `export async function runUnitSync(job: ResearchJob, deadline: number): Promise<SliceOutcome>` — orders the list by kind then id, resumes at `job.cursor`, for each entry until `deadline - 8_000 ms`: orphan → delete its units; `indexedRevision !== sourceRevision` → `ingestSource`; `needsEmbedding` only → embed and update those rows; persists `cursor`/`total` through the existing job state path; `done` when the list is exhausted; failures per source are counted in `state.failures` and never stop the slice.

- [ ] **Step 1: Failing tests:** `runUnitSync` ingests a stale source, deletes an orphan, re-embeds a source missing embeddings, stops at the deadline with `done: false` and a cursor, finishes with `done: true`; `runResearchJob` dispatches `unit_sync`; `listArtistUnitSources` (PGlite) joins the three kinds and flags orphans.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run `pnpm test`, pass. Step 5: Commit** — `feat(units): unit_sync job for backfill and catch-up`
- [ ] **Step 6: Open A1 as a draft PR.** Body: migration dependency (W1, applied to staging first), the backfill SQL (`insert into artist_research_jobs (artist_id, kind, status, state) select distinct artist_id, 'unit_sync', 'pending', '{"backfill":true}'::jsonb from artist_vault_sources on conflict do nothing`, run by hand through an authorized connection), and that nothing reads the units yet.

---

### Task 13: Hybrid search

**Files:**
- Create: `lib/units/eligibleUnitsSql.ts` + PGlite test
- Create: `lib/units/searchUnitsByText.ts` + PGlite test
- Create: `lib/units/searchUnitsByVector.ts` + test (real Postgres, opt-in, Task 21)
- Create: `lib/units/fuseRanks.ts` + test
- Create: `lib/units/expandSearchQueries.ts` + test
- Create: `lib/units/searchUnits.ts` + test
- Create: `lib/units/embedQuery.ts` + test

**Interfaces:**
- `export function eligibleUnitsSql(artistId: string, alias = "u")` — the predicate from the spec: `u.artist_id = $artistId` and, by kind, the source row exists, is public (`publicVaultSourceSql()` for vault; own non-repost for social; the confirmed-candidate conditions copied from `lib/questionResearch/loadPublicResearchOriginals.ts:84` for evidence) **and its current revision equals `u.source_revision`**. Stale units are therefore invisible without a reindex.
- `export async function searchUnitsByText(artistId: string, query: string, limit = SEARCH_CANDIDATES): Promise<UnitHit[]>` — `websearch_to_tsquery('english', $query)`, `ts_rank_cd(u.search, q)` as score, `where ... and u.search @@ q`; an empty or stopword-only query returns `[]` before touching the database.
- `export async function searchUnitsByVector(artistId: string, embedding: number[], limit = SEARCH_CANDIDATES): Promise<UnitHit[]>` — `order by u.embedding OPERATOR(extensions.<=>) $vec::extensions.vector`, score = `1 - distance`, `u.embedding is not null`.
- `export function fuseRanks(lists: UnitHit[][], k = RRF_K): UnitHit[]` — reciprocal rank fusion keyed by `(sourceKind, sourceId, unitIndex)`, score = Σ 1/(k + rank), descending, stable.
- `export function expandSearchQueries(question: string, names: string[]): string[]` — `[question]` plus, when the question does not already contain any name, `question + " " + names[0]`; no model call.
- `export async function embedQuery(text: string, opts?: { signal?: AbortSignal }): Promise<number[]>` — one `embed` call to `MODEL_EMBEDDING`.
- `export async function searchUnits(artistId: string, question: string, opts: { names: string[]; signal?: AbortSignal; deps?: {...} }): Promise<{ hits: UnitHit[]; weak: boolean }>` — for each expanded query: text candidates and, with the query embedding (one embedding of the raw question, reused), vector candidates; fuse; cap `MAX_UNITS_PER_DOCUMENT` per `(sourceKind, sourceId)`; top `SEARCH_LIMIT`; `weak` is true when no text candidate matched and the best vector distance exceeds `WEAK_COSINE_DISTANCE`. An embedding failure degrades to text-only (logged, not thrown).

- [ ] **Step 1: Failing tests** (PGlite for SQL; pure for fusion/expansion; `searchUnits` with mocked collaborators):

```ts
test("eligibleUnitsSql hides a unit whose vault source is private", ...)
test("eligibleUnitsSql hides a unit whose source revision moved on", ...)
test("searchUnitsByText ranks the page containing the phrase first", ...)
test("searchUnitsByText returns [] for stopwords without querying", ...)   // query "the of" → db.execute not called
test("fuseRanks promotes a unit present in both lists", ...)
test("expandSearchQueries adds the artist name once", ...)
test("searchUnits caps units per document and marks weak results", ...)
test("searchUnits falls back to text when embedding fails", ...)
```

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(units): hybrid search with reciprocal rank fusion`

---

### Task 14: Retrieval eval

**Files:**
- Create: `lib/evals/retrievalCases.ts`, `lib/evals/retrievalGates.ts` + test, `lib/evals/retrievalReporter.ts`, `evals/retrieval.eval.ts`
- Modify: `lib/evals/createEvalBudgetFetch.ts:99-147` + test; `.github/workflows/evals.yml:9-17` (suite option `retrieval`); `docs/chat-eval-pdf-evidence.md` (new section "Retrieval eval")

**Interfaces:**
- `export type RetrievalCase = { key: string; artistId: string; artistName: string; question: string; expected: { sourceKind: UnitSourceKind; sourceId: string; locator: string }[]; note: string };` `export const RETRIEVAL_CASES: RetrievalCase[]` — the twelve chat questions plus the #118 follow-up, labelled against staging after the backfill (the Dutchyyy PDF page numbers come from `chatCases.ts`; the source ids are read from staging by the builder and are UUIDs, not secrets).
- Scorers in `evals/retrieval.eval.ts`: `recall_at_8` (share of expected pairs present in `hits`, matched on `sourceId` and `locator`), `reciprocal_rank` (1 / rank of the first expected hit, 0 when absent). Task: `searchUnits(artistId, question, { names: [artistName] })` behind `createEvalBudgetFetch`. No unit text is logged or scored by a model.
- `export const RETRIEVAL_GATES = { meanRecall: 0.8, maxRank: 8 }`; `checkRetrievalGates(rows): string[]` fails when the mean recall is below 0.8 or any case has `reciprocal_rank === 0`.
- Spend guard: gateway requests whose pathname ends with `/embedding-model` are priced at $0.02 per million input tokens (`Math.ceil(JSON.stringify(values).length / 4)` tokens) under `MODEL_EMBEDDING`; any other `ai-gateway.vercel.sh` path that is not `/language-model` fails closed with "unpriced gateway path". The first hosted run confirms the embedding path name; if the gateway uses another suffix, fix it in the same PR.

- [ ] **Step 1: Failing tests** for gates and the guard. **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**
- [ ] **Step 5: Hosted run on staging** after W1 is applied there and the backfill job has drained: `gh workflow run evals.yml --ref claude/units-retrieval -f suite=retrieval`. Record recall and reciprocal rank per case in `docs/chat-eval-pdf-evidence.md`; the run must pass the gates before Task 18's flag is turned on anywhere. Tune ranking (RRF_K, candidate counts, the alias expansion) in this task until it does; a case that cannot be made to pass is reported, not relabelled.
- [ ] **Step 6: Commit** — `feat(evals): retrieval eval with recall and rank gates`

---

### Task 15: `createChatDocuments`

**Files:**
- Create: `lib/chat/createChatDocuments.ts`, `lib/chat/__tests__/createChatDocuments.test.ts`

**Interfaces:**
- Consumes: `CiteSource` from `lib/chat/createChatCitations.ts:3`.
- Produces: `export type ChatDocumentRef = { sourceKind: UnitSourceKind; sourceId: string; revision: string; title: string; url: string | null };` `export type ChatDocuments = { register(ref: ChatDocumentRef): number; get(n: number): ChatDocumentRef | undefined; all(): { n: number; ref: ChatDocumentRef }[] };` `export function createChatDocuments(cite: CiteSource, prior: { n: number; ref: ChatDocumentRef }[] = []): ChatDocuments` — numbers are per `(sourceKind, sourceId)`, assigned on first registration by calling `cite({ url: url ?? \`musicnerd://\${sourceKind}/\${sourceId}\`, title })` so the `source-url` part is written; `prior` entries are registered first, in ascending `n`, so a follow-up keeps the earlier numbering; registering a document already numbered returns its number without a new part.

- [ ] **Step 1: Failing tests:** first registration cites and returns 1; same document again returns 1 with one part written; prior documents are re-registered in order at construction and keep their numbers; `all()` lists them.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(chat): document registry that carries citation numbers across turns`

---

### Task 16: Passage tools

**Files:**
- Create: `lib/chat/createSearchPassagesTool.ts`, `lib/chat/createReadUnitsTool.ts`, `lib/chat/createListDocumentsTool.ts`, tests beside each
- Create: `lib/units/readUnits.ts` + PGlite test; `lib/units/listArtistDocuments.ts` + PGlite test
- Modify: `lib/chat/createWebSearchTool.ts:13` (`createWebSearchTool(cite, opts?: { maxCalls?: number })`, default 2; the third call returns `{ error: "Web search limit reached for this answer" }`) + test

**Interfaces:**
- `export async function readUnits(artistId: string, ref: { sourceKind; sourceId }, locators: string[]): Promise<{ revision: string; units: { locator: string; text: string; tokens: number }[] } | null>` — eligible and current units only (`eligibleUnitsSql`); `null` when none qualify.
- `export async function listArtistDocuments(artistId: string): Promise<{ sourceKind; sourceId; title: string; url: string | null; units: number; indexing: boolean }[]>` — eligible sources with their current unit counts; `indexing` when a source is eligible but has no current units.
- `createSearchPassagesTool(artistId: string, documents: ChatDocuments, opts: { names: string[]; signal?: AbortSignal; search?: typeof searchUnits })` — input `{ query: string }`; output `{ results: { n: number; locator: string; title: string; passage: string }[]; weak: boolean; documents: { n: number; sourceKind; sourceId; revision: string; title: string; url: string | null }[] }`; `passage` is the unit text trimmed to `PASSAGE_CHARS` around the first query term match (whole text when shorter). The `documents` array is what Task 17 replays from history.
- `createReadUnitsTool(artistId: string, documents: ChatDocuments, budget: { remainingTokens: number })` — input `{ n: number; locators: string[] }` (1 to 6 locators); output `{ n, title, units: { locator, text }[], truncated: boolean }` or `{ error: "Source changed or is no longer public" }` when `readUnits` returns null or the revision differs from the registered one; decrements `budget.remainingTokens`, truncating at zero.
- `createListDocumentsTool(artistId: string, documents: ChatDocuments)` — output `{ documents: { n: number | null; title; kind; units; indexing }[] }`, where `n` is set when the document is already registered.

- [ ] **Step 1: Failing tests** (collaborators mocked; PGlite for the two SQL modules):

```ts
test("searchPassages registers each document once and returns passages with n", ...)
test("searchPassages reports weak results", ...)
test("readUnits returns an error when the document is no longer public", ...)   // Review Focus 1
test("readUnits refuses a revision that moved on", ...)
test("readUnits truncates at the token budget", ...)
test("listDocuments marks sources without current units as indexing", ...)
test("webSearch refuses a third call", ...)
```

- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(chat): searchPassages, readUnits and listDocuments tools; web search cap`

---

### Task 17: Conversation currency

**Files:**
- Create: `lib/units/assertDocumentsCurrent.ts` + PGlite test
- Create: `lib/chat/keepCurrentCitedTurns.ts` + test (replaces `keepCurrentPdfTurns.ts` in Task 20; both exist until then)
- Modify: `lib/chat/validateArtistChatBody.ts` + test

**Interfaces:**
- `export async function assertDocumentsCurrent(artistId: string, refs: { sourceKind; sourceId; revision }[]): Promise<void>` — one query returning the current revision of every ref (same per-kind predicates as `eligibleUnitsSql`, on the source tables); throws `Error("Source changed or is no longer public")` naming no text when any ref is missing or differs. Empty input returns without a query.
- `validateArtistChatBody`: an assistant message keeps its text parts plus `documents: ChatDocumentRef & { n }[]` collected from `tool-searchPassages` and `tool-readUnits` parts in state `output-available` (zod: `n` 1..64, `sourceKind` enum, `sourceId` uuid, `revision` 1..300 chars, `title` 1..300, `url` string | null), at most 16 documents per message; otherwise `parts = []` as today. `MAX_PARTS` stays 64. `pdfReads` handling is untouched until Task 20.
- `export async function keepCurrentCitedTurns(messages: HistoryMessage[], artistId: string): Promise<{ messages: HistoryMessage[]; prior: { n: number; ref: ChatDocumentRef }[] }>` — one `assertDocumentsCurrent`-style lookup for all distinct refs; an assistant message is kept only when every document it cites is current; `prior` is the union of documents from kept messages, by `n`, for `createChatDocuments`.

- [ ] **Step 1: Failing tests:** body validation keeps `documents` and drops a message with 17; `keepCurrentCitedTurns` drops the turn whose document moved on (Review Focus 2), keeps the others, looks every ref up once, returns `prior` in `n` order; `assertDocumentsCurrent` throws on a withdrawn vault source and on a changed revision, passes on current ones, makes no query for `[]`.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass. Step 5: Commit** — `feat(chat): replay earlier answers only while their documents are current`

---

### Task 18: Handler switch behind `CHAT_RETRIEVAL`

**Files:**
- Modify: `lib/chat/postArtistChatHandler.ts:56-95` + test, `lib/chat/buildArtistChatInstructions.ts:8` + test, `.env.example`
- Create: `lib/chat/getChatRetrievalMode.ts` + test

**Interfaces:**
- `export function getChatRetrievalMode(env = process.env): "units" | "legacy"` — `CHAT_RETRIEVAL=units` selects units; anything else is legacy (the default until Task 20).
- `buildArtistChatInstructions(artistName: string, now = new Date(), mode: "units" | "legacy" = "legacy")`. Units mode text states, in this order: search first with `searchPassages`; read with `readUnits` only when a claim needs more than the passage; use `listDocuments` for "every"/"all" questions and before saying something is absent; cite as `[n, p.N]` for pages and `[n, §Heading]` or `[n, ¶N]` otherwise, numbers from the tools only, including numbers carried from earlier turns; for first/earliest/when questions read two documents and report disagreement; when `weak` is true and `webSearch` cannot answer, say the sources do not cover it; `searchSources` with `retrieval: "latest"` is for current releases only.
- Handler in units mode: no `loadPublicResearchOriginals`; `originals` = `loadPublicLatestOriginals` (`lib/questionResearch/loadPublicLatestOriginals.ts:12`) + stored latest providers only, so `searchSources`/`readSource` serve the "latest" path; `keepCurrentCitedTurns` provides history and `prior`; `documents = createChatDocuments(cite, prior)`; tools `{ searchPassages, readUnits, listDocuments, searchSources, readSource, webSearch }`; `beforeStep` runs one `assertDocumentsCurrent(artistId, documents.all())`; `maxOutputTokens: 1500`; `stopWhen: isStepCount(6)` unchanged; `gateStepText` unchanged. Legacy mode is byte-for-byte today's path.

- [ ] **Step 1: Failing tests:** mode parsing; in units mode the handler never calls `loadPublicResearchOriginals`, builds the six tools, revalidates once per step with every registered document, and passes `maxOutputTokens` 1500; in legacy mode the existing handler tests still pass unchanged; instructions contain the citation forms and the weak-results sentence.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run `pnpm test`, pass. Step 5: Commit** — `feat(chat): passages retrieval behind CHAT_RETRIEVAL`

---

### Task 19: Answer eval on passages

**Files:**
- Modify: `lib/evals/readChatEvidence.ts` + test (`tool: "readSource" | "webSearch" | "searchPassages" | "readUnits"`; evidence text is the tool output's passages/units, no refetch), `evals/chat.eval.ts` (metadata `retrieval: getChatRetrievalMode()`), `.github/workflows/evals.yml` (input `retrieval` choice `legacy|units`, passed as `CHAT_RETRIEVAL`), `docs/chat-eval-pdf-evidence.md` (section "Passages run")
- Modify: `lib/evals/chatStreamTurn.ts` (`assistantParts` carries `documents` from the new tools, so the follow-up case replays)

- [ ] **Step 1: Failing tests** for `readChatEvidence` with the two new tools and for `chatStreamTurn` history parts.
- [ ] **Step 2: Run, fail. Step 3: Implement. Step 4: Run, pass.**
- [ ] **Step 5: Hosted comparison.** With W1 applied and the backfill drained on staging, and Task 14's gates passing: `gh workflow run evals.yml --ref claude/units-chat -f suite=chat -f retrieval=units`, then once with `retrieval=legacy` on the same commit. Record both in the evidence note: gate result, means, first signal, first text, total time, and the per-question deltas. The units run must pass the chat gates (`lib/evals/chatGates.ts`) before Task 20.
- [ ] **Step 6: Commit** — `feat(evals): judge passage-cited answers; hosted comparison recorded`

---

### Task 20: Flip the default, remove the native read, update labels and docs

**Files (API, PR A4):**
- Modify: `lib/chat/getChatRetrievalMode.ts` (default `units`; `CHAT_RETRIEVAL=legacy` opts out for one release, then the env var is removed in a follow-up), `lib/chat/postArtistChatHandler.ts` (legacy branch removed), `lib/chat/validateArtistChatBody.ts` (`pdfReads` removed), `lib/units/ingestUploadInline.ts` (page count via `extractPdfPages`)
- Delete: `lib/chatPdf/` (all files and tests), `lib/chat/keepCurrentPdfTurns.ts` + test, `lib/evals/readPdfChatEvidence.ts` + test, `evals/chat-pdf-text.eval.ts` and its workflow option, `lib/chat/createReadSourceTool.ts`'s 12,000-character cap stays (latest items only)
- Modify: `docs/chat-eval-pdf-evidence.md` (what changed), `README.md`

**Files (Web, PR W2):** `src/lib/artistChat/getChatProgress.ts:22-27` + test: `tool-searchPassages` → "Searching N documents…" is not available from the part, so "Searching saved documents…"; `tool-readUnits` → "Reading <title> <locator>…" from the output; `tool-listDocuments` → "Listing documents…"; the PDF tool lines are removed.

**Files (Docs, PR D1, opened first per the docs-first rule):** the chat endpoint's description and stream part names in the chat OpenAPI file (tool part types `tool-searchPassages`, `tool-readUnits`, `tool-listDocuments`; `source-url` parts may carry `musicnerd://` URLs for documents without a public URL; citation forms `[n, p.N]`, `[n, §Heading]`, `[n, ¶N]`).

- [ ] **Step 1: Docs PR D1** with the contract change; link it from A4.
- [ ] **Step 2: Failing tests** for the default mode and for the Web labels. **Step 3: Implement and delete.** `pnpm type-check`, `pnpm lint:check`, `pnpm test`, Web `npm test`.
- [ ] **Step 4: Hosted run** `suite=chat` on A4's head with no `retrieval` input (default units): must pass the gates. Record in the evidence note.
- [ ] **Step 5: Commit and mark the three PRs ready** — `feat(chat)!: answer from passages; native PDF read removed`

---

### Task 21: Real-Postgres tests for the vector path

**Files:**
- Create: `lib/units/__tests__/searchUnitsByVector.postgres.test.ts` (pattern of `lib/spotifyMatch/__tests__/spotifyMatch.integration.test.ts:36-37`: `describe.skipIf(!process.env.MUSICNERD_UNITS_TEST_URL)`; the URL must be localhost; the test creates the extension, the table from the 0044 SQL text and three rows, then asserts the nearest unit is first and a stale one is hidden)
- Modify: `.github/workflows/ci.yml` (a `postgres` service from the `pgvector/pgvector:pg17` image, `MUSICNERD_UNITS_TEST_URL` pointing at it, so CI runs the test; the Vitest job otherwise unchanged)

- [ ] **Step 1: Write the test, run it against a local pgvector Postgres, see it pass; confirm it is skipped without the variable.**
- [ ] **Step 2: Add the CI service; push; confirm the job runs the test (look for its name in the CI log, not for unit text).**
- [ ] **Step 3: Commit** — `test(units): vector search against real Postgres in CI`

---

## Self-review notes (2026-11-13)

- Spec coverage: ingest (Tasks 3 to 12), store/index (1, 2, 8), retrieve (13), answer loop (16, 18), conversation (15, 17), evaluation (14, 19), migration steps 1 to 6 (1, 11 to 12, 14, 18 to 20). Partner API and Web retirements: separate plans by design. The spec's "status line names what is being read" is Task 20's Web change; "Searching 14 documents…" is not possible from a tool part and is written as "Searching saved documents…" (my call).
- Names used consistently: `UnitSourceKind`, `UnitDraft`, `UnitHit`, `IngestOutcome`, `ChatDocumentRef`, `ChatDocuments`, `searchUnits`, `readUnits`, `assertDocumentsCurrent`, `keepCurrentCitedTurns`, `getChatRetrievalMode`, `MODEL_EMBEDDING`, `MODEL_OCR`, `vaultSourceRevisionSql`, `socialPostRevisionSql`, `eligibleUnitsSql`.
- Calls made here, not in the spec: output cap 1,500 tokens; 2 web searches per answer; inline ingest up to 40 pages; `WEAK_COSINE_DISTANCE` 0.6; `musicnerd://kind/id` URL for documents without a public URL; `unit_sync` as one job kind per artist with a manual backfill insert; PGlite tests use a text domain for `vector` and the real operator is covered in CI by Task 21.
