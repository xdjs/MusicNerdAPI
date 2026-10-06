import { z } from "zod";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";

const nullableString = z.string().nullable();
const base = { version: z.literal(1), id: z.uuid(), artistId: z.uuid(), url: z.string() };
const schema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("vault"),
    status: z.enum(["approved", "pending", "rejected"]),
    origin: z.string(),
    type: nullableString,
    filePath: nullableString,
    title: nullableString,
    snippet: nullableString,
    extractedText: nullableString,
    publishedAt: nullableString,
    createdAt: z.string(),
    updatedAt: nullableString,
  }),
  z.object({
    ...base,
    kind: z.literal("social"),
    platform: z.string(),
    ownerUsername: z.string(),
    isOwnPost: z.boolean(),
    caption: nullableString,
    postedAt: nullableString,
    transcript: z.unknown(),
    isRepost: z.unknown(),
    isRetweet: z.unknown(),
  }),
]);

/** Decodes selected DB fields and reuses the original public citation hash/eligibility rules. */
export function normalizeKnowledgeSourceSnapshot(snapshot: unknown, artistId: string) {
  const row = schema.parse(snapshot);
  return normalizeArtistKnowledge({
    artist: { id: artistId, name: null, bio: null },
    summary: null,
    vault: row.kind === "vault" ? [row] : [],
    social: row.kind === "social" ? [row] : [],
    answers: [],
    corrections: [],
    jobs: [],
  }).sources;
}
