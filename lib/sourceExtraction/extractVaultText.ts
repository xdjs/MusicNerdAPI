import { parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];

/** Parse original HTML without executing scripts; retain a bounded article/main/body text region. */
export function extractVaultText(html: string) {
  const document = parse(html);
  const ignored = new Set([
    "head",
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "iframe",
    "nav",
    "footer",
    "aside",
    "form",
    "button",
    "select",
    "dialog",
  ]);
  const blocks = new Set([
    "p",
    "div",
    "section",
    "article",
    "li",
    "ul",
    "ol",
    "tr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "figcaption",
    "dd",
    "dt",
    "pre",
    "table",
    "br",
    "hr",
  ]);
  const regions: { node: Node; scope: "article" | "main" | "body" }[] = [];
  function hidden(node: Node): boolean {
    return (
      ignored.has(node.nodeName) ||
      ("attrs" in node &&
        node.attrs.some(
          a => a.name === "hidden" || (a.name === "aria-hidden" && a.value === "true"),
        ))
    );
  }
  function visit(node: Node) {
    if (hidden(node)) return;
    if (node.nodeName === "article" || node.nodeName === "main" || node.nodeName === "body")
      regions.push({ node, scope: node.nodeName });
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  function read(node: Node): string {
    if (hidden(node)) return "";
    if (node.nodeName === "#text" && "value" in node) return node.value.replace(/\s+/g, " ");
    const value = "childNodes" in node ? node.childNodes.map(read).join("") : "";
    return blocks.has(node.nodeName) ? `\n\n${value}\n\n` : value;
  }
  visit(document);
  const candidates = regions.map(r => ({
    scope: r.scope,
    text: read(r.node)
      .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  }));
  const selected = candidates
    .filter(r => r.scope === "article" && r.text.length >= 50)
    .sort((a, b) => b.text.length - a.text.length)[0] ??
    candidates.find(r => r.scope === "main") ??
    candidates.find(r => r.scope === "body") ?? { scope: "body" as const, text: "" };
  let end = Math.min(50_000, selected.text.length);
  if (end < selected.text.length && /[\uD800-\uDBFF]/.test(selected.text[end - 1])) end--;
  return {
    text: selected.text.slice(0, end),
    scope: selected.scope,
    totalChars: selected.text.length,
    truncated: end < selected.text.length,
  };
}
