import { parse, type DefaultTreeAdapterMap } from "parse5";

/** Retain an unambiguous source-declared publication date, never an event/fetch date. */
export function extractPublicationDate(html: string): string | null {
  const document = parse(html);
  const dates = new Set<string>();
  function visit(node: DefaultTreeAdapterMap["node"], inHead = false) {
    const head = inHead || node.nodeName === "head";
    if (head && node.nodeName === "meta" && "attrs" in node) {
      const attributes = Object.fromEntries(node.attrs.map(a => [a.name, a.value]));
      const name = (attributes.property ?? attributes.name ?? "").toLowerCase();
      if (["article:published_time", "datepublished"].includes(name)) {
        const value = attributes.content?.trim() ?? "";
        const day = value.slice(0, 10);
        // Keep a date-only declaration date-only; do not invent a time zone or precision.
        if (
          /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
            value,
          ) &&
          Number.isFinite(Date.parse(value)) &&
          Number.isFinite(Date.parse(day)) &&
          new Date(day).toISOString().slice(0, 10) === day
        ) {
          dates.add(value);
        }
      }
    }
    if ("childNodes" in node) node.childNodes.forEach(child => visit(child, head));
  }
  visit(document);
  return dates.size === 1 ? [...dates][0] : null;
}
