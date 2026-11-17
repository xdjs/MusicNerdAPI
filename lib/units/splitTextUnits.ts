import { MAX_UNIT_CHARS } from "@/lib/units/types";

type TextUnit = { locator: string; text: string };
type Group = { firstParagraph: number; cutPart: number; text: string };

const PARAGRAPH_BREAK = /\n[ \t]*\n/;
const HEADING_PREFIX = /^#{1,6}[ \t]/;
// Each paragraph is charged its own length plus the 2-character break after it.
const BREAK_COST = 2;

function paragraphsOf(text: string): string[] {
  return text
    .split(PARAGRAPH_BREAK)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

/** Groups paragraphs up to maxChars; a paragraph longer than maxChars is cut at maxChars. */
function pack(paragraphs: string[], maxChars: number): Group[] {
  const groups: Group[] = [];
  let current: { firstParagraph: number; parts: string[]; cost: number } | null = null;
  const flush = () => {
    if (current)
      groups.push({
        firstParagraph: current.firstParagraph,
        cutPart: 1,
        text: current.parts.join("\n\n"),
      });
    current = null;
  };
  paragraphs.forEach((paragraph, i) => {
    const number = i + 1;
    if (paragraph.length > maxChars) {
      flush();
      for (let start = 0, part = 1; start < paragraph.length; start += maxChars, part++) {
        groups.push({
          firstParagraph: number,
          cutPart: part,
          text: paragraph.slice(start, start + maxChars),
        });
      }
      return;
    }
    const cost = paragraph.length + BREAK_COST;
    if (current && current.cost + cost > maxChars) flush();
    current ??= { firstParagraph: number, parts: [], cost: 0 };
    current.parts.push(paragraph);
    current.cost += cost;
  });
  flush();
  return groups;
}

/** Trims whitespace and closing # marks with a single linear scan (no regex backtracking on user text). */
function headingText(raw: string): string {
  let end = raw.length;
  while (end > 0 && (raw[end - 1] === "#" || raw[end - 1] === " " || raw[end - 1] === "\t")) end--;
  return raw.slice(0, end).trim();
}

function withPart(locator: string, part: number): string {
  return part > 1 ? `${locator} (${part})` : locator;
}

export function splitTextUnits(
  text: string,
  kind: "markdown" | "plain",
  maxChars = MAX_UNIT_CHARS,
): TextUnit[] {
  text = text.replace(/\r\n?/g, "\n");
  if (kind === "plain") {
    return pack(paragraphsOf(text), maxChars).map(group => ({
      locator: withPart(`¶${group.firstParagraph}`, group.cutPart),
      text: group.text,
    }));
  }

  const sections: { heading: string; lines: string[] }[] = [{ heading: "Top", lines: [] }];
  for (const line of text.split(/\r?\n/)) {
    const prefix = HEADING_PREFIX.exec(line);
    if (prefix) sections.push({ heading: headingText(line.slice(prefix[0].length)), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }

  const units: TextUnit[] = [];
  for (const section of sections) {
    pack(paragraphsOf(section.lines.join("\n")), maxChars).forEach((group, i) => {
      units.push({ locator: withPart(`§${section.heading}`, i + 1), text: group.text });
    });
  }
  return units;
}
