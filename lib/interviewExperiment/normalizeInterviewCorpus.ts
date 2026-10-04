import { roleIsSomebodyElsesHandle } from "@/lib/credits/roleIsSomebodyElsesHandle";
import type {
  CorpusRows,
  InterviewCorpus,
  InterviewEvidence,
} from "@/lib/interviewExperiment/types";

/** Normalize a private DB snapshot; export selected source text, never raw provider payloads.
 * @param rows - Explicitly selected database fields.
 * @param capturedAt - Time of this snapshot.
 * @returns A reusable corpus with provenance and current signal-builder inputs.
 */
export function normalizeInterviewCorpus(rows: CorpusRows, capturedAt: string): InterviewCorpus {
  const text = (v: unknown): string =>
    typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "";
  const own = (r: Record<string, unknown>) => r.artist_id === rows.artist.id;
  const evidence: InterviewEvidence[] = [];
  const posts = rows.posts.filter(r => own(r) && r.is_own_post === true);
  for (const p of posts) {
    const url = text(p.url),
      id = text(p.id);
    const base = {
      group: url,
      metadata: {
        musicTitle: text(p.music_title) || null,
        musicArtist: text(p.music_artist) || null,
        coauthors: Array.isArray(p.coauthors)
          ? p.coauthors.filter((v): v is string => typeof v === "string")
          : [],
        mentions: Array.isArray(p.mentions)
          ? p.mentions.filter((v): v is string => typeof v === "string")
          : [],
      },
      url,
      publishedAt: text(p.posted_at) || null,
      availableAt: text(p.created_at) || capturedAt,
    };
    if (text(p.caption).trim())
      evidence.push({
        ...base,
        id: `post:${id}`,
        kind: "post",
        text: text(p.caption),
        attribution: "artist",
      });
    const raw = p.raw as { _musicnerdTranscript?: Record<string, unknown> } | null;
    const transcript = raw?._musicnerdTranscript;
    if (
      p.platform === "instagram" &&
      transcript?.version === 1 &&
      transcript.actor === "apify/instagram-reel-scraper" &&
      text(transcript.runId) &&
      text(transcript.text).trim() &&
      Number.isFinite(Date.parse(text(transcript.fetchedAt)))
    ) {
      evidence.push({
        ...base,
        id: `transcript:${id}`,
        kind: "transcript",
        text: text(transcript.text),
        attribution: "speaker unverified",
        availableAt: new Date(
          Math.max(Date.parse(base.availableAt), Date.parse(text(transcript.fetchedAt))),
        ).toISOString(),
      });
    }
  }
  for (const s of rows.sources.filter(r => own(r) && r.status === "approved")) {
    const body = text(s.extracted_text) || text(s.snippet);
    if (!body.trim()) continue;
    evidence.push({
      id: `lore:${text(s.id)}`,
      group: text(s.url) || text(s.id),
      kind: "lore",
      text: `SOURCE TITLE: ${text(s.title)}\n${body}`,
      url: s.file_path ? null : text(s.url) || null,
      attribution: "source author",
      publishedAt: text(s.published_at) || null,
      availableAt: text(s.updated_at) || text(s.created_at) || capturedAt,
    });
  }
  for (const a of rows.answers.filter(r => own(r) && text(r.answer).trim())) {
    evidence.push({
      id: `answer:${text(a.id)}`,
      group: `answer:${text(a.id)}`,
      kind: "answer",
      text: `PREVIOUS QUESTION (not evidence): ${text(a.question)}\nANSWER (artist's words): ${text(a.answer)}`,
      url: null,
      attribution: "artist",
      publishedAt: null,
      availableAt: text(a.created_at) || capturedAt,
    });
  }
  for (const c of rows.corrections.filter(own)) {
    evidence.push({
      id: `correction:${text(c.id)}`,
      group: `correction:${text(c.id)}`,
      kind: "correction",
      text: `REJECTED CLAIM: ${text(c.claim)}\nARTIST CORRECTION (${text(c.kind)}): ${text(c.correction) || "Remove this claim; do not repeat it."}`,
      url: null,
      attribution: "artist",
      publishedAt: null,
      availableAt: text(c.updated_at) || text(c.created_at) || capturedAt,
    });
  }
  const extraction: InterviewCorpus["baseline"]["extraction"] = { credits: [], statements: [] };
  for (const c of rows.credits.filter(own)) {
    const source = posts.find(p => text(p.url) === text(c.source_url));
    if (!source || !text(c.quote) || !text(source.caption).includes(text(c.quote))) continue;
    if (
      c.kind === "credit" &&
      text(c.subject) &&
      !roleIsSomebodyElsesHandle(text(c.label), text(c.subject), text(c.quote))
    )
      extraction.credits.push({
        subject: text(c.subject),
        isHandle: c.is_handle === true,
        isSelf: c.is_self === true,
        role: text(c.label),
        quote: text(c.quote),
        url: text(c.source_url),
        postedAt: text(c.posted_at) || null,
      });
    else if (c.kind !== "credit")
      extraction.statements.push({
        quote: text(c.quote),
        topic: text(c.label),
        url: text(c.source_url),
        postedAt: text(c.posted_at) || null,
      });
  }
  return {
    version: 1,
    capturedAt,
    artist: rows.artist,
    evidence,
    baseline: {
      extraction,
      posts: posts.map(p => ({
        platform: text(p.platform),
        platformPostId: text(p.platform_post_id),
        ownerUsername: text(p.owner_username),
        isOwnPost: true,
        caption: text(p.caption) || null,
        url: text(p.url),
        postedAt: text(p.posted_at),
        likeCount: typeof p.like_count === "number" ? p.like_count : null,
        commentCount: typeof p.comment_count === "number" ? p.comment_count : null,
        playCount: typeof p.play_count === "number" ? p.play_count : null,
        hashtags: Array.isArray(p.hashtags)
          ? p.hashtags.filter((v): v is string => typeof v === "string")
          : [],
        mentions: Array.isArray(p.mentions)
          ? p.mentions.filter((v): v is string => typeof v === "string")
          : [],
        coauthors: Array.isArray(p.coauthors)
          ? p.coauthors.filter((v): v is string => typeof v === "string")
          : [],
        musicTitle: text(p.music_title) || null,
        musicArtist: text(p.music_artist) || null,
      })),
    },
  };
}
