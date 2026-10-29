import type { CanvasEvidence } from "./const";
/** Introduce a path through public evidence, never substitute for a canonical biography. */
export function buildCanvasOrientation(name: string, evidence: CanvasEvidence[]) {
  const identity = evidence.find(item => item.category === "identity" && item.text.trim());
  const work = evidence.find(item => item.workUrl || item.category === "release");
  const quote = evidence.find(item => item.category === "quote" && item.attribution);
  const other =
    evidence.find(item => item.category === "document") ?? evidence.find(item => item.text.trim());
  const lead = work ?? other;
  const selected = [identity, lead, quote].filter(
    (item, index, all): item is CanvasEvidence =>
      !!item && all.findIndex(entry => entry?.id === item.id) === index,
  );
  const text = lead
    ? `${identity ? `${identity.text} ` : ""}${work ? `A good way into ${name} is ${work.title}.` : `Let’s begin with ${name} through ${lead.title}.`}${identity ? "" : ` ${lead.text}`}${quote && quote.id !== lead.id ? ` There’s a personal reason to explore further, too: “${quote.text}” (${quote.attribution}).` : ""}`
    : `There’s not enough public material here for me to introduce ${name} reliably yet. We can start with their profile links and follow the work from there.`;
  return {
    text,
    kind: "orientation" as const,
    sourceUrl: lead?.url ?? "https://musicnerd.net/",
    sources: selected.map(item => ({ url: item.url, label: item.title })),
  };
}
