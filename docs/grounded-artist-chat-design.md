# Grounded artist chat: ingestion, retrieval, answers and the partner API

Design proposal for Pete, 2026-11-13. Status: approved by Pete on 2026-11-13, with the changes marked "amended 2026-11-13" below agreed in the same conversation; nothing in it is built yet. Written by Claude after the #1424 work, when Pete asked for the whole flow to be reconsidered rather than tuned.

## Intent

Music Nerd chat should answer the way a frontier assistant with a document library does: something on screen within a second, the right passages found across every approved source an artist has, an answer written from those passages with exact citations, follow-ups that remember the conversation, and an honest "not in the sources" when that is the truth. The same engine should serve partners through the API with the most accurate answer Music Nerd can give, with provenance they can check.

Today the chat sends whole PDFs to the model as bytes, two per answer, and ranks documents by a substring match over an unindexed text blob. Text that upload already extracts is thrown away at answer time. That works for a handful of documents and does not scale in cost, latency or recall.

## Decisions already made (Pete, 2026-11-13)

- OCR is in the first version: a scanned page is read, not skipped.
- The native whole-PDF read is removed, not kept as a fallback. Existing uploads (mostly Dutchyyy's) are reprocessed.
- Build for the long term. Retrieval recommendation below follows from that.
- The grounding check is enforced on the partner answer and only recorded on the streamed chat (amended 2026-11-13).
- The retrieval eval runs before the chat switch and gates it (amended 2026-11-13).
- The first version searches without a model rewrite of the question; alias expansion needs no model (amended 2026-11-13).
- The vision pass has two triggers: no text layer, or extracted text that looks broken (amended 2026-11-13).

## Goals

- Every approved source, whatever its type (PDF upload, text or markdown upload, web page, social post, research-found page), becomes one canonical document: markdown with provenance, split into addressable units (physical pages for PDFs, sections for everything else).
- One retrieval path across all of an artist's documents, good enough that the right page is in the top eight for the questions the eval asks.
- Answers cite a unit, "[3, p.8]" or "[2, §Early years]", and every citation resolves to a passage the reader can open.
- Follow-ups keep the conversation and its citations; an earlier answer is kept only while the documents it relied on are still published unchanged.
- Partners get an answer endpoint that returns the answer, the citations, the passages behind them and their provenance (source, locator, publication revision), and a retrieval-only endpoint for those who want to compose their own.
- Evaluation covers retrieval (is the right page found), answers (the existing gates), follow-ups, latency and cost per answer.

## Non-goals

- Questions across artists, or about Music Nerd itself.
- Changing the publication, approval or claim rules. The index only ever contains what a public read may see today, and every read re-checks that.
- Replacing web research. Tavily stays as the fallback when the sources cannot answer.
- Fine-tuning or training on sources.

## Anti-goals

- Answering from a withdrawn or changed document, in the first turn or a follow-up.
- Leaking protected source text into public places: logs, PRs, public pages. Passages are returned to clients only in the sizes citations need, and never printed in CI.
- Unbounded spend: per-answer token and tool budgets, and the existing allowances, stay.

## Constraints and existing material

- Supabase Postgres with pgvector available; one database shared by Web and API.
- Every model call goes through the Vercel AI Gateway; the hosted Evals workflow holds the credential; secrets never leave Vercel or GitHub.
- Both repositories are public.
- External clients keep working untouched: SleeveNote (and Bopping) query artists by Spotify ID through the public lookups the API serves at `api.musicnerd.net`, and the legacy `api.musicnerd.xyz` domain still points at the Web app for them. Nothing in this design changes those routes, the `artists` table, the middleware, CORS or the domains; the implementation plan checks them in every PR.
- The existing consumers of `extracted_text` (bio, fun facts, Lore rebuild, research review) keep working: that column stays populated.
- The eval already extracts page-marked text from PDFs the way ingestion will (`lib/evals/readPdfChatEvidence.ts`), so the judge and the chat will finally read the same representation.

## The flow today, and where it breaks

Facts from a read of both repositories on 2026-11-13 (API branch `claude/1424-chat-pdf-reach`, Web branch `claude/1424-citation-page-labels`). File paths are repository-relative.

**Answering a question** (`lib/chat/postArtistChatHandler.ts`):

- Every turn loads the artist's whole corpus into memory: public text sources, the artist's own posts, confirmed discoveries and latest originals, full text, no truncation (`lib/questionResearch/loadPublicResearchOriginals.ts`). Hard caps of 5,000 rows and 4,000,000 characters; past either the chat fails with a 503 rather than answering from less (`lib/knowledge/types.ts:212`). No cache; the size check runs the scope query twice.
- `searchSources` runs BM25 in memory over 1,600-character windows of the entire corpus on every call, re-tokenizing each time; four ranked passages, at most two per source, padded to eight by unranked eligible sources (`lib/knowledge/searchArtistKnowledge.ts`, `lib/questionResearch/selectResearchReferences.ts`). The model sees a hostname as the title and a 300-character snippet.
- `readSource` returns the first 12,000 characters of a source, never the matching passage (`lib/chat/createReadSourceTool.ts:8`). Anything deeper in a long source is unreachable.
- PDFs: discovery scores by `position()` of query terms over the full `extracted_text` of every eligible PDF, no index (`lib/chatPdf/loadChatPdfs.ts`); reading fetches the original bytes (3 s, 4 MiB, 50 pages) and sends them to the model base64-encoded, re-sent on every step, two files per answer (`lib/chatPdf/createChatPdfTools.ts`).
- Before every model step, every source shown so far is revalidated with its own query, plus every PDF, plus a `loadChatPdfs` per conversion: with eight sources and six steps, dozens of queries per turn (`postArtistChatHandler.ts:82-89`, `lib/sourcePublication/assertPublicSourceCurrent.ts`).
- Bounds on a turn: six steps and the route's 60 s. No output token cap, no per-turn web-search cap, Tavily at 6 s per call.
- Admission: one global advisory lock serializes every chat admission platform-wide; 200 questions a day across all visitors; 30 an hour per visitor (`lib/questionResearch/reserveQuestionPlanning.ts`). The daily number is a product ceiling, not a safety margin.

**Citations and follow-ups:**

- Numbers are assigned per turn in order of first use and each writes a `source-url` part (`lib/chat/createChatCitations.ts`). The page links only numbers the text cites that have a part (`src/lib/artistChat/getChatSources.ts`).
- Earlier answers keep their `[n]` markers but lose their source parts. The model is told not to reuse old numbers; when it does, the page strips them, or, if the number coincides with a source in the new turn, links the wrong source silently (`src/lib/artistChat/removeUnresolvedCitations.ts`, `AskAboutArtist.tsx:64-98`).
- History is the last twelve messages, text only; nothing is persisted or summarized server-side. Any turn that read a PDF is dropped entirely on `main`; #118 keeps it while the PDF is unchanged.

**Other answer paths that overlap:** question research (`app/api/artist/[id]/research/questions`) is a queued job on Gemini 3.8 Flash that selects evidence and does not write an answer; of its quota codes, `saved_evidence_quota` is handled by both the API map and the page, `outside_research_quota` is emitted but handled by neither, and `research_quota` is handled by both and emitted by nothing (a dead branch). The chat path itself can only raise `visitor_question_quota`, `question_planning_quota` or the corpus-too-large 503 (corrected 2026-11-13). The onboarding chat is a separate claimant flow.

**The public API and what partners can get today:**

- All 98 method-and-path pairs under `app/api/**` are documented in the Docs repo's OpenAPI files; the convention is docs first, then the API change with tests, then the client (Docs `AGENTS.md`). There are no versioned paths, no deprecation headers and no changelog; compatibility has been kept with opt-in query flags.
- The chat stream is public (Privy optional) and is the only public thing resembling a grounded answer: text plus `source-url` parts carrying `{ sourceId: n, url, title }`. PDF page numbers exist only inside the answer text. No passage, offset, revision or confidence is returned. The handler's 503 is undocumented; the quota codes the chat can actually emit are in the contract.
- Question research (service key) returns references with `sourceId`, `revision`, `start`/`end`, `text`, `url` and dates, but no answer and no page number. The private knowledge routes (Privy) already have a `Passage` shape with `revision`, `start`/`end`, `page` and `startSeconds`/`endSeconds`, with retained historical revisions. The partner endpoint below is that shape made public and paired with an answer, not a new model.
- The research key header is not in the CORS allow-list, so browsers cannot send it; the authentication guide never mentions it.
- Evals measure answers (relevance, groundedness, citations, timings) on twelve single-turn cases. Not measured: retrieval quality (is the right page found), multi-turn, latency percentiles, cost per answer, the research endpoints, quota behaviour.

**Ingestion today:**

- The API owns uploads (`/api/vault/upload/{sign,complete}`; the Web only calls them): 10 MB, PDF, txt, md, csv, json, doc, docx, png, jpeg, webp, mp3, wav. Only PDFs and text formats get `extracted_text`; images, audio, doc and docx get nothing. No OCR anywhere. A PDF between 4 and 10 MB uploads and can never be read by chat.
- PDF text comes from `pdf-parse` as one trimmed string: page boundaries are lost at ingest (`lib/vaultUpload/extractPdfText.ts`). Web pages are fetched and reduced to block text capped at 50,000 characters with a `truncated` flag (`lib/sourceExtraction`); headings and sections are not marked. Social posts keep caption and a reel transcript up to 12,000 characters; research evidence keeps up to 50,000 characters of original text.
- `extracted_text` is plain text with no structure, and every recorded revision includes it: the chat PDF revision (`updated_at:md5(extracted_text):publication` on #117), the source-versions fingerprint (sha256 over the row snapshot, which carries `extractedText`), the Lore and directory guards (digests over the same snapshot) and the research revision. Rewriting it in place would invalidate every one of them. The design below therefore adds a table and leaves the blob alone. The snapshot function builds its JSON from named columns, so adding a column to `artist_vault_sources` changes no revision (corrected 2026-11-13).
- The chat's text corpus (`publicTextVaultSourceSql`) excludes PDFs entirely; PDFs reach the model only through the PDF tools. So the two halves of the corpus are searched by two unrelated mechanisms.
- Duplicated implementations across the two repositories: the publication gate SQL (identical copies), three HTML-to-text extractors, two Lore synthesizers, two research web searches, two drizzle schemas, two artist-name searches. The `(artist_id, url)` unique index on vault sources is declared in the API's schema copy and in Web migration 0014, but not in the Web schema file that owns migrations. These are why "one ingestion path, in the API" is a principle below and not a detail.
- The publication rule a public read must satisfy (one paragraph, `lib/sourcePublication/publicVaultSourceSql.ts`): status approved, and publication public, or publication inherit with either an approved claim for the artist or a trusted submission event matching the row's origin; private always blocks. Reads of saved originals recheck the gate and the revision; Lore reads require the gated set to equal the recorded one.

## Principles

- **One ingestion path, in the API.** The API already owns uploads and page extraction; the Web's parallel copies (its own Lore synthesizer, research web search, HTML extractor, publication SQL) stop being written to and are retired as the units take over. Two repositories, one pipeline.
- **The model reads text, not files.** Markdown units with locators are the only thing an answer is written from. Originals stay in storage, hashed, for verification and for humans.
- **Eligibility is checked, never cached.** Every retrieval joins the publication gate; every later step re-checks the revisions of what it cited; a follow-up replays an earlier answer only while its documents are unchanged.
- **Every claim resolves to a passage** a reader or a partner can open, with a locator. If it cannot, the claim is not made.
- **Measure before and after.** Retrieval recall and the answer gates run on staging fixtures before the switch and after it; the switch happens behind a flag.

## The pipeline

### 1. Ingest: one path for every source

A single `ingestSource(sourceId)` job in the API, run on upload, on approval, and by the backfill. It produces one canonical document and its units:

- **Document header** (markdown front matter kept as columns, not parsed by the model): title, source type, URL, author or account where known, published date where known, language, byte hash of the original, publication revision.
- **Units.** PDF: one unit per physical page, text from the page renderer the eval uses today, with `[page N]` as the unit locator. Web page: no HTML is kept today, only block text capped at 50,000 characters whose hash is part of the revision; so for existing pages the units are sections of that stored text with paragraph-offset locators ("[2, ¶14]"), never a re-fetch, which would break the same-revision guarantee (my call). From the switch on, the extraction job also stores a markdown rendering with headings beside the text, so new pages get heading-path locators ("[2, §Early years]"). Social post: one unit, locator is the post. Text or markdown upload: units by heading, or the whole file when short. Interview answer: one unit per answer, locator is the question.
- **Markdown, not plain text.** Headings, lists and tables survive as markdown; running headers, footers and page numbers inside the text are stripped where detectable. Tables matter for discographies and credits.
- **Every kind of source the public chat already draws on.** Units come from vault documents (PDF, text and markdown uploads, web pages), the artist's own social posts (caption plus reel transcript) and research evidence originals: three of the five kinds `loadPublicResearchOriginals` assembles today. The other two stay on the existing "latest" path, which the model keeps as the `searchSources`/`readSource` tools with `retrieval=latest` (my call): latest-provider items (Spotify and Deezer releases, refreshed daily or faster, structured data that churns too fast for an index), and the artist's published interview answers. Those answers are public today under a rule in `lib/questionResearch/loadPublicLatestOriginals.ts`: a follow-up answer, or an onboarding answer once the artist's onboarding has a `publish` step; the chat already reads them, so nothing is lost by leaving them on that path in the first version. Indexing them as units is a follow-up (corrected 2026-11-13 after the Task 18 review; an earlier correction wrongly said only the private routes read them). One table and one search for everything written; one live tool for what is current.
- **OCR, the vision pass.** Text extraction is the path for every PDF with a text layer, which is every current upload. A page goes to a vision model through the gateway only when its text layer is empty or near-empty, or when the extracted text looks broken: words fused without spaces, a high share of non-word characters, or a column layout the extractor has scrambled (amended 2026-11-13; the detection heuristic is the builder's). The page is read once and stored like any other page with `ocr = true`. How the page reaches the model: the API has no PDF rasterizer (`pdf-parse` and `sharp` do not render pages), so the first version splits the document into one-page PDFs and sends each page as a file part, the way the chat sends bytes today; rendering pages to images is a later option if a model needs it. No staging upload is known to lack a text layer, so the proof uses a committed synthetic fixture, a small image-only PDF of a neutral sentence, read through the gateway in the hosted Evals workflow before the queue design is committed (my call). Image uploads (press photos, flyers, scans) get the same treatment: one unit of OCR text plus a one-line description. Audio uploads are out of scope for the first version (the reel-transcript path is the obvious later home). Cost is per scanned page at ingest, never at question time: about a tenth of a cent on Gemini Flash or a third of a cent on Sonnet at gateway list prices on 2026-11-13.
- **Sizes.** The upload limit stays 10 MB. Reading no longer fetches bytes at question time, so the 4 MiB and 50-page chat limits go away; ingest handles up to a page cap (about 300) in the same terminable worker the inspector uses today.
- **Provenance per unit:** source kind and id, unit index, locator, character count, hash of the unit text, `ocr` flag, ingested-at, the ingest version (so a better extractor can reprocess selectively), and the source revision the units were built from.
- **When units exist.** For a text-layer document, units and embeddings are written in the same request that completes the upload (one pdf-parse pass, one batched embedding call), so a document is searchable the moment it is approved. OCR, image uploads and documents past a size threshold go to the existing research-jobs queue in one-minute slices, and the backfill runs through the same queue. Until a document's units exist, `listDocuments` reports it as "indexing" and the status line can say so; the chat answers from what is indexed and never falls back to reading bytes (my call). The shared queue is enough for the current corpus; a dedicated worker is an operations decision for later, noted under "Left to the builder".
- **Compatibility:** `extracted_text` is not rewritten. It is inside every revision the Lore guards and the versions trigger compare (each is a digest over the source snapshot), so changing it would invalidate recorded revisions across Lore. The units live in their own table; consumers of the blob keep working unchanged. The one exception is a source whose blob is null because extraction failed (scanned PDFs, images): OCR fills it once, which is a new revision for a source that had no citable text before.

### 2. Store and index

A `source_units` table (name to be settled by the builder): `id`, `source_kind` (vault, social, evidence), `source_id`, `artist_id`, `source_revision`, `unit_index`, `locator`, `text`, `text_hash`, `tokens`, `ocr`, `ingest_version`, `search` (a generated `tsvector` over title and text, GIN-indexed), `embedding` (`vector`, HNSW-indexed), timestamps. Rows are written in one batch per document inside one transaction and replaced atomically when a document is reprocessed. The migration is additive: no existing column changes, no change to the versions trigger's snapshot function.

- Eligibility is not stored in the unit; it is joined at query time from the source's publication state, so a withdrawal takes effect at the next question with no reindex.
- Partial indexes on `(artist_id)` for the common filter; the FTS and vector indexes carry every unit.
- Embeddings use one gateway embedding model recorded in `ingest_version`; changing models means reprocessing, which the backfill job already knows how to do.
- The table replaces, for answering, the whole-corpus load and the in-memory BM25 that run on every turn today. `loadPublicResearchOriginals` and `searchArtistKnowledge` stay for the research and knowledge routes until those move too; the chat stops calling them. The 5,000-row and 4-million-character ceilings stop applying to chat.
- The private knowledge routes' `Passage` shape (`revision`, `start`/`end`, `page`, `startSeconds`/`endSeconds`) is the unit's public face; a unit is a passage with a locator. Nothing new is invented for partners.

### 3. Retrieve: hybrid from day one

Recommendation for "build for the long term": keyword and vector together, fused. Keyword search alone misses paraphrase ("who produced" versus "production credit"); vectors alone miss exact names, dates and catalogue numbers, which is most of what a music fan asks. Together they cover each other, and the fusion is twenty lines of SQL.

- **Search strings.** The first version searches with the question itself and an alias-expanded form built from the artist's known names, which needs no model call (amended 2026-11-13). A model rewrite (a keyword form, a paraphrase) is added only when the retrieval eval shows a paraphrase gap; when it is, it runs in parallel with the raw-question search and its lists are fused in as they arrive, so the rewrite never delays the first results.
- **Candidates.** For each string: top 20 by `ts_rank_cd` on the GIN index and top 20 by cosine distance on the HNSW index, filtered to the artist and to currently published sources.
- **Fusion.** Reciprocal rank fusion across all lists; then at most three units per document and the top eight overall. A re-ranker slot is left in the design and left empty.
- **Returned to the model:** for each hit, the document number `n` (citation numbers are assigned here, once per document per conversation), the locator, and the unit text trimmed to about 1,200 characters around the matched span. Reading a whole unit, or neighbouring units, is a second tool.

Tools the model has:

- `searchPassages(query)`: the hybrid search above, the first call on every question.
- `readUnits(n, locators[])`: full text of chosen units, for expansion; bounded by a token budget per answer.
- `listDocuments()`: the inventory of the artist's documents with unit counts, for "every" questions.
- `webSearch(query)`: unchanged, the fallback when the sources cannot answer.

The two-reads-per-answer limit disappears. What bounds an answer instead is a token budget for retrieved text (about 12,000 tokens), a step budget, an output token cap (missing today) and a per-turn web-search cap (missing today).

**Revalidation, once per step instead of once per source per step.** Today every shown source is re-checked with its own query before every model step. The unit query joins publication state, so a retrieval is current by construction; before each later step one batched query checks the revisions of every document cited so far. One query per step, whatever the number of sources.

**Admission.** The single platform-wide advisory lock and the 200-questions-a-day ceiling are not changed by this design, but they are the next bottleneck once answers are cheap, and the design does not depend on either: admission can move to a per-visitor lock and a configurable daily allowance without touching retrieval or answering. Flagged as a product decision.

### 4. Answer: the loop a frontier assistant runs

- **First signal under a second.** The status line already exists on the artist page; it now names what is being searched and read ("Searching 14 documents…", "Reading timeline.pdf p.2…").
- **Plan, retrieve, expand, write.** The instructions ask for one `searchPassages` call first, expansion only when a claim needs more than the trimmed passage, and writing from what was read. The inventory and two-source rules from #117 stay as instructions; they become cheap because a scan is a search, not a whole-file read.
- **Grounding check.** A second, cheap pass (the judge model's smaller sibling, or the same model at low effort) checks each cited sentence against its passage and marks any it cannot support. Where it is enforced depends on the transport (amended 2026-11-13). The partner answer endpoint is not streamed, so there the check runs before the response is returned: unsupported sentences are dropped or softened and `grounded` reports the result. The chat is streamed, so by the time the check finishes the text is already on the page; there the check runs after the stream, is recorded for the eval and surfaced as a marker on the message, and never rewrites what the reader has seen. Holding the chat answer until the check passes would give back the first-text time this design buys. This is what makes the partner answer trustworthy without a human in the loop; cost is one small call per answer.
- **Abstention.** When the fused top results are weak (a score floor) and web search is unavailable or also weak, the answer says so plainly.
- **Streaming.** Unchanged transport; planning narration stays gated as in #117.

### 5. Conversation

- History keeps the text of earlier turns and the documents each answer cited (document ids, revisions, locators), the way #118 keeps `pdfReads`, generalized to every source type.
- An earlier answer is replayed only while every document it cited is still published at the same revision; otherwise it is dropped and the model re-answers.
- **Citations carry across turns.** The server re-registers the documents an earlier answer cited, so "[1]" in a follow-up resolves to the same document and the page shows a link instead of a bare claim. Today a reused number is silently stripped.
- Conversation state stays client-carried, as today: the page sends the messages back, the server keeps nothing and keys nothing to an anonymous visitor (my call: no new privacy surface in the first version). Long conversations are bounded by the existing twelve-message window; the earlier idea of a server-side running summary is dropped from this version. The partner endpoint's `conversation` is the same client-carried shape.

### 6. The partner API

- `POST /api/v1/artist/{id}/answer` (non-streaming): `{ question, conversation? }` in; out: `{ answer, citations: [{ n, sourceId, title, url, locator, revision, passage }], grounded: boolean, abstained: boolean, usage: { tokens, ms } }`. Passages are the trimmed units the answer cited, enough to verify, not whole documents.
- `GET /api/v1/artist/{id}/passages?q=`: retrieval only, the same hybrid search, for partners composing their own answers.
- The streaming chat endpoint is unchanged for the artist page.
- Auth and limits: the research API key for partners, per-key allowances alongside the per-visitor one, `v1` in the path of the two new routes only, the chat path unversioned (my call, 2026-11-13; the first versioned paths in the API, which today keeps compatibility with opt-in flags), documented in the Docs repo with the same OpenAPI layout as chat. Order of work follows the Docs rule: docs first, then the API with tests, then clients.
- Two contract repairs ride along: the chat endpoint's 503 is documented, and the research key header joins the CORS allow-list and the authentication guide.

### 7. Evaluation

- **Retrieval eval (new):** a hand-labelled set of question to (document, locator) pairs for the staging fixtures; score recall at 8 and reciprocal rank. Runs without a chat model, so it is cheap and can run on every change to ingestion or ranking. It is built right after the backfill and must pass before the chat switch (migration step 4, amended 2026-11-13); its floor is proposed from the first run against the labelled set. Labels are made without printing any passage: a hosted listing run prints, per question, the candidate documents as title, public URL and locator only; the labeller opens the public document and marks the right pages or sections. Pete confirms the labels, as he did the chat references.
- **Answer eval:** the existing chat suite and gates, judged by GPT-5.4, unchanged in method; its PDF evidence adapter becomes a read of the stored units, since the model and the judge now see the same text.
- **Follow-up eval:** the two-turn case from #118, extended to citation carry-over.
- **Latency and cost:** first signal, first text, total time and tokens per answer recorded per row; thresholds proposed after the first backfilled run.
- **OCR spot check:** a few scanned pages compared by hand once.

### 8. Migration

1. Add the table and indexes (one migration, additive).
2. Ship `ingestSource` and run it on new uploads; nothing reads the units yet.
3. Backfill: a job over existing approved sources, oldest first, Dutchyyy's documents first by hand; the existing research "advance" scheduler pattern can drive it. Record failures per source.
4. Retrieval eval: label the question-to-page set from the twelve chat cases and their follow-ups, run it against the backfilled index, and tune ranking until recall at 8 meets the floor. Nothing switches until this passes (amended 2026-11-13).
5. Switch the chat tools to passages behind a flag on staging; run the answer eval; compare to the #117 record.
6. Remove the native read, the two-file limit and `readPdfSource`; the eval's PDF evidence adapter reads units.
7. Ship the partner endpoints last, after the chat has run on passages for a release.

### 9. Cost and latency (estimates, to be measured)

|  | Today | Proposed |
| --- | --- | --- |
| Input per PDF-backed answer | ~1,500 tokens per page read, up to two whole files | ~2,000 to 12,000 tokens of passages |
| Answer start | 7 to 12 s | 3 to 6 s (no file fetch, no whole-file read) |
| Ingest per PDF page | one pdf-parse pass | one pass plus one embedding; plus one vision call if scanned |
| Per question extra calls | none | one grounding check (small model); a rewrite only if the retrieval eval calls for it |
| Cost per PDF-backed answer | about 14 cents measured (`docs/chat-eval-pdf-evidence.md`) | 1 to 3 cents: 2k to 12k passage tokens at Sonnet 5.5's gateway list price of $2 per million input tokens (2026-11-13) |
| Embedding at ingest | none | $0.02 per million tokens on `openai/text-embedding-3-small` (gateway list, 2026-11-13); the whole current corpus for a few cents |

## Cleanups found on the way

Not part of the design, but found while mapping the flow and cheap to fix in passing:

- Two copies of `extractPdfText` (Web `src/server/utils/extractPdfText.ts`, API `lib/vaultUpload/extractPdfText.ts`); ingestion makes the API's the only one. Likewise the publication gate SQL (identical in both repos), three HTML-to-text extractors, two Lore synthesizers, two research web searches and two artist-name searches.
- The `(artist_id, url)` unique index on vault sources is in Web migration 0014 and the API's schema copy, but not in the Web schema file that owns migrations.
- `buildDocContext` matches source ids to text by list position after ranking, a known mismatch noted in its own comment.
- `research_quota` is handled by the API map and the page but emitted by nothing; `outside_research_quota` is emitted by research but handled by neither.
- The chat contract omits the 503 the handler returns.
- Two eval scorers (`lib/evals/judgeAnswer.ts`, `lib/evals/scorers/scoreAnswerQuality.ts`) are referenced only by their own tests; the Web's `validateMagicBytes.ts` is imported only by its test.
- A comment in the Web's `artistDocService.ts` refers to an `askArtist` route that no longer exists.

## Left to the builder

Table and column names; the exact unit size for HTML, social and evidence text; the embedding model and dimension; the OCR model and how a "near-empty" text layer is detected; the rewrite and grounding models; the RRF constant and score floor; how the backfill job is scheduled and how failures are retried; the page cap at ingest; the broken-extraction heuristic and the one-page PDF split for the vision pass; the retrieval eval's labelled set (built from the twelve chat cases plus their follow-ups); migration numbering (both repositories share the database and each keeps a schema file; the migration lands once, in the Web repo's `drizzle/`, and both schema files are updated).

## Where the Web stands (decided with Pete, 2026-11-13)

Pete's rule: the Web may keep reading the shared database for its own pages, but anything that produces text, indexes it or answers from it lives in the API, and the Web reaches it through the API. Unused code goes, but only once every use is accounted for.

Today the Web does not go through the API for everything: it has its own drizzle schema, its own Lore synthesizer, research web search and HTML extractor, and a copy of the publication SQL. The design treats these as follows:

| Web code | Used by (Web) | Fate | When |
| --- | --- | --- | --- |
| Lore synthesizer (`artistDocService.ts`, `artistDoc/synthesizeArtistDoc.ts`) | artist page Lore, claimant dashboard | Replaced by the API's Lore rebuild reading units; Web calls the API route | after the chat switch, before retiring the Web copy |
| Research web search (`queries/vaultWebSearch.ts`) | `dashboardActions.ts`, `evals/runResearchCase.ts` | Replaced by the API's `searchAndPopulateVault` route | same phase; the Web eval moves with it |
| HTML extractor (`fetchPageContent.ts`) | `addVaultSource.ts` (podcast metadata only) | Keep only the metadata fetch; body text already comes from the API | same phase |
| Publication SQL (`bio/publicVaultSourceSql.ts`) | public bio and Lore reads | Keep as a read-side copy until those reads move; a drift test compares it to the API's | ongoing |
| `validateMagicBytes.ts` | its own test only | Delete | any time |
| `extractPdfText.ts` | no production caller found | Delete after a grep in the Web main branch confirms it | any time |

Rule for every row: nothing is deleted until the API route serving the same flow exists, the Web flow is switched to it, and the Web's tests for that flow pass against the API. The chat switch does not wait for this table; the table is the phase after it.

Partner access in the first version: one key with one allowance. A key registry (keys table, issuance, revocation, admin surface) is built when there is a second partner.

Open points found by the builder check (2026-11-13), for the partner plan: `MUSICNERD_RESEARCH_API_KEY` is the Web's own server credential and grants service access to the research routes, so handing it to a partner widens what the partner can call and ties rotation to a Web redeploy; the recommendation is a second env var accepted only by the two partner routes, still one key and one allowance. And whether partner answers draw from the fan chat's 200-a-day pool and its single admission lock, or from their own allowance. Both are Pete's calls before the partner plan is written; neither affects part 1.

## Open questions for Pete

None outstanding. Decisions recorded above: OCR in v1 with two triggers; native read removed; hybrid retrieval; grounding check enforced on the partner answer and recorded on the chat; retrieval eval before the switch; no model rewrite in the first version; Web scope and partner keys as in the previous section. Approved by Pete on 2026-11-13.
