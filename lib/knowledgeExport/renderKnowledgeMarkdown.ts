import type { DocSource } from "@/lib/lore/types";

/**
 * The Lore document as one self-contained Markdown file: a header saying what
 * it is, the document with its [n] markers, and the numbered sources at the
 * end, so every citation resolves wherever the file is pasted. The same text
 * as MusicNerdWeb's public llms.txt, so a citation resolves the same either way.
 *
 * @param input - What goes in the file.
 * @param input.name - The artist's name, the file's title.
 * @param input.content - The Lore document.
 * @param input.sources - Its numbered sources.
 * @param input.header - The quoted line saying what the reader holds and when it was taken.
 * @returns The Markdown.
 */
export function renderKnowledgeMarkdown(input: {
  name: string;
  content: string;
  sources: DocSource[];
  header: string;
}): string {
  const lines: string[] = [
    `# ${input.name}`,
    "",
    input.header,
    `> Bracketed numbers in the text refer to the numbered sources at the end.`,
    "",
    input.content.trim(),
    "",
    "## Sources",
    "",
  ];
  for (const s of input.sources) {
    const label = s.label ?? s.url ?? "(untitled)";
    const when = s.publishedAt ? ` (${s.publishedAt.slice(0, 10)})` : "";
    lines.push(s.url ? `${s.id}. ${label}${when} — ${s.url}` : `${s.id}. ${label}${when}`);
  }
  return lines.join("\n");
}
