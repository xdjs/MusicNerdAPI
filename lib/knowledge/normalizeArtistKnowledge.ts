import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { knowledgeRevision } from "@/lib/knowledge/knowledgeRevision";
import { knowledgeWindow } from "@/lib/knowledge/knowledgeWindow";
import { MAX_KNOWLEDGE_CHARS, MAX_KNOWLEDGE_ROWS } from "@/lib/knowledge/types";
import type {
  Evidence,
  HistoryEntry,
  KnowledgeJob,
  KnowledgeSnapshot,
  KnowledgeSource,
  RawKnowledge,
} from "@/lib/knowledge/types";

/** Converts eligible stored records to evidence without promoting metadata to facts. */
export function normalizeArtistKnowledge(raw: RawKnowledge): KnowledgeSnapshot {
  const tables = [raw.vault, raw.social, raw.answers, raw.corrections, raw.jobs];
  const size = JSON.stringify(raw).length;
  if (tables.some(rows => rows.length > MAX_KNOWLEDGE_ROWS) || size > MAX_KNOWLEDGE_CHARS)
    throw new KnowledgeError(
      "corpus_too_large",
      413,
      "Artist corpus exceeds the supported snapshot size",
    );
  const date = (value: unknown): string | null => {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toISOString();
  };
  const publicUrl = (value: string): string | null => {
    try {
      const url = new URL(value);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        [...url.searchParams.keys()].some(key => /token|secret|signature|api[-_]?key/i.test(key))
      )
        return null;
      return value;
    } catch {
      return null;
    }
  };
  const sources: Evidence[] = [];
  const add = (text: string, metadata: Omit<KnowledgeSource, "revision">) => {
    // Retrieval time is not an evidence revision; all citation metadata is.
    const { ingestedAt: _ingestedAt, ...citation } = metadata;
    void _ingestedAt;
    sources.push({
      text,
      metadata: { ...metadata, revision: knowledgeRevision([citation, text]) },
    });
  };
  const clip = (value: string | null, max: number) =>
    value === null ? null : knowledgeWindow(value, 0, max).text;
  for (const row of raw.vault) {
    if (row.artistId !== raw.artist.id || row.status !== "approved") continue;
    const text = row.extractedText ?? "";
    const upload = Boolean(row.filePath) || row.origin === "upload";
    const limits = ["Legacy extraction completeness is unknown; stored text may omit material."];
    if (/pdf/i.test(row.type ?? "") || /\.pdf(?:$|[?#])/i.test(row.url))
      limits.push("No verified PDF page map or OCR coverage is stored.");
    else limits.push("Legacy website extraction may be capped at 50,000 characters.");
    add(text, {
      sourceId: `vault:${row.id}`,
      kind: "vault",
      title: clip(row.title, 300),
      titleTruncated: (row.title?.length ?? 0) > 300,
      description: clip(row.snippet, 600),
      descriptionTruncated: (row.snippet?.length ?? 0) > 600,
      url: upload ? null : publicUrl(row.url),
      publishedAt: date(row.publishedAt),
      ingestedAt: null,
      uploadedAt: null,
      eventDate: null,
      originalSourceUrl: null,
      provenance: {
        origin: upload ? "vault_upload" : "vault_link",
        provider: null,
        method: "legacy_extracted_text",
        speaker: "unverified",
        publisher: null,
        speakerName: null,
        relationship: "unknown",
      },
      extraction: {
        readiness: text.trim() ? "ready" : "unknown",
        storedChars: text.length,
        truncated: null,
        limitations: limits,
      },
    });
  }
  for (const row of raw.social) {
    if (
      row.artistId !== raw.artist.id ||
      !row.isOwnPost ||
      row.isRepost === true ||
      row.isRetweet === true
    )
      continue;
    const base = {
      title: null,
      titleTruncated: false,
      description: null,
      descriptionTruncated: false,
      url: publicUrl(row.url),
      publishedAt: date(row.postedAt),
      uploadedAt: date(row.postedAt),
      ingestedAt: null,
      eventDate: null,
      originalSourceUrl: null,
    };
    if (row.caption !== null)
      add(row.caption, {
        ...base,
        sourceId: `social:${row.id}:caption`,
        kind: "social_caption",
        provenance: {
          origin: "social_caption",
          provider: row.platform,
          method: "stored_caption",
          speaker: "not_applicable",
          publisher: row.ownerUsername,
          speakerName: null,
          relationship: "unknown",
        },
        extraction: {
          readiness: row.caption.trim() ? "ready" : "unknown",
          storedChars: row.caption.length,
          truncated: null,
          limitations: [
            "Account ownership does not establish authorship of quoted text or an original/repost relationship.",
          ],
        },
      });
    const saved =
      row.transcript && typeof row.transcript === "object"
        ? (row.transcript as Record<string, unknown>)
        : null;
    if (
      row.platform === "instagram" &&
      saved?.version === 1 &&
      saved.actor === "apify/instagram-reel-scraper" &&
      typeof saved.text === "string" &&
      saved.text.trim()
    )
      add(saved.text, {
        ...base,
        ingestedAt: date(saved.fetchedAt),
        sourceId: `social:${row.id}:transcript`,
        kind: "reel_transcript",
        provenance: {
          origin: "provider_transcript",
          provider: "apify/instagram-reel-scraper",
          method: "provider_transcript",
          speaker: "unverified",
          publisher: row.ownerUsername,
          speakerName: null,
          relationship: "unknown",
        },
        extraction: {
          readiness: "ready",
          storedChars: saved.text.length,
          truncated: null,
          limitations: [
            "Legacy reel storage may be capped at 12,000 characters; no verified speaker or audio timestamp map.",
          ],
        },
      });
  }
  sources.sort((a, b) => a.metadata.sourceId.localeCompare(b.metadata.sourceId));
  const field = (name: HistoryEntry["fields"][number]["field"], text: string | null) => ({
    field: name,
    text,
    start: 0,
    end: text?.length ?? 0,
    totalChars: text?.length ?? 0,
    complete: true,
  });
  const history: HistoryEntry[] = [];
  for (const row of raw.corrections
    .filter(row => row.artistId === raw.artist.id)
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const entry = {
      entryId: `correction:${row.id}`,
      kind: "correction" as const,
      questionKey: null,
      answerState: null,
      sitting: null,
      offeredAt: null,
      answerUpdatedAt: null,
      source: null,
      correctionKind: row.kind,
      fields: [field("claim", row.claim), field("correction", row.correction)],
    };
    history.push({ ...entry, revision: knowledgeRevision(entry) });
  }
  const answers = raw.answers
    .filter(row => row.artistId === raw.artist.id)
    .sort(
      (a, b) =>
        (date(b.offeredAt) ?? "").localeCompare(date(a.offeredAt) ?? "") ||
        a.id.localeCompare(b.id),
    );
  for (const row of answers) {
    const entry = {
      entryId: `answer:${row.id}`,
      kind: "answer" as const,
      questionKey: row.questionKey,
      answerState:
        row.answer !== null
          ? ("answered" as const)
          : row.source === "offered"
            ? ("offered" as const)
            : ("skipped" as const),
      sitting: row.sitting,
      offeredAt: date(row.offeredAt),
      answerUpdatedAt: row.answer !== null ? date(row.createdAt) : null,
      source: row.source,
      correctionKind: null,
      fields: [field("question", row.question), field("answer", row.answer)],
    };
    history.push({ ...entry, revision: knowledgeRevision(entry) });
  }
  const latest = history
    .filter(entry => entry.answerState === "answered")
    .sort(
      (a, b) =>
        (b.answerUpdatedAt ?? "").localeCompare(a.answerUpdatedAt ?? "") ||
        a.entryId.localeCompare(b.entryId),
    )[0];
  const jobs: KnowledgeJob[] = raw.jobs
    .filter(row => row.artistId === raw.artist.id)
    .map(row => {
      if (
        ![
          "social_ingest",
          "caption_extract",
          "lore_refresh",
          "source_search",
          "latest_refresh",
          "source_extract",
        ].includes(row.kind) ||
        !["pending", "running", "done", "failed"].includes(row.status) ||
        row.cursor < 0 ||
        (row.total !== null && row.total < 0)
      )
        throw new KnowledgeError(
          "storage_unavailable",
          503,
          "Stored research status is unsupported",
        );
      const parsed =
        row.kind === "source_extract"
          ? sourceExtractionSchemas.outcome.array().max(20).safeParse(row.extractionOutcomes)
          : null;
      if (parsed && !parsed.success)
        throw new KnowledgeError(
          "storage_unavailable",
          503,
          "Stored extraction status is unsupported",
        );
      return {
        ...(parsed?.success ? { extractionOutcomes: parsed.data } : {}),
        jobId: row.id,
        kind: row.kind as KnowledgeJob["kind"],
        status: row.status as KnowledgeJob["status"],
        cursor: row.cursor,
        total: row.total,
        updatedAt: date(row.updatedAt),
        errorCategory: row.status === "failed" ? "research_failed" : null,
      };
    })
    .sort(
      (a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.jobId.localeCompare(b.jobId),
    );
  const summary =
    raw.summary &&
    typeof raw.summary === "object" &&
    "text" in raw.summary &&
    typeof raw.summary.text === "string"
      ? raw.summary.text
      : null;
  const readable = sources.filter(source => source.text.trim()).length;
  return {
    artist: raw.artist,
    summary,
    sources,
    history,
    latestAnswer: latest ? { entryId: latest.entryId, revision: latest.revision } : null,
    jobs,
    coverage: {
      eligibleSources: sources.length,
      readableSources: readable,
      searchedSources: 0,
      complete: readable === sources.length,
      limitations: [...new Set(sources.flatMap(source => source.metadata.extraction.limitations))],
    },
  };
}
