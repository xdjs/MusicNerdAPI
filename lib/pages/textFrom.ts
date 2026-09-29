import { BLOCK_BREAK, CHROME_TAGS } from "@/lib/pages/const";
import { decodeEntities } from "@/lib/pages/decodeEntities";

/**
 * Text from body HTML, keeping block structure as blank lines.
 *
 * @param bodyHtml - The page's body HTML.
 * @param stripChrome - Remove nav, footer, forms and the rest of `CHROME_TAGS` with their contents; otherwise only script and style.
 * @returns The text, with paragraphs separated by blank lines.
 */
export function textFrom(bodyHtml: string, stripChrome: boolean): string {
  let html = bodyHtml.replace(/<!--[\s\S]*?-->/g, " ");
  if (stripChrome) {
    for (const tag of CHROME_TAGS) {
      html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ");
    }
  } else {
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ");
  }
  return (
    decodeEntities(html.replace(BLOCK_BREAK, "\n\n").replace(/<[^>]+>/g, " "))
      // Horizontal whitespace only: collapsing newlines flattened every page to one line.
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
