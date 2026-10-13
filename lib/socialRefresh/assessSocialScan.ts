import type { SocialScan, ScanPost, ScanReference } from "./types";
/** Recent-feed continuity only: does not certify complete historical or provider coverage. */
export function assessSocialScan(
  scan: SocialScan,
  posts: ScanPost[],
  allMapped: boolean,
): {
  connected: boolean;
  reference: ScanReference;
} {
  const previous = scan.reference;
  const empty: ScanReference = { anchors: [], observedAt: scan.startedAt, gapSince: null };
  const eligible = posts.filter(post => !post.pinned);
  const valid =
    allMapped &&
    eligible.length > 0 &&
    eligible.every(
      post =>
        post.id.length > 0 &&
        Number.isFinite(Date.parse(post.postedAt)) &&
        Date.parse(post.postedAt) <= Date.parse(scan.startedAt),
    ) &&
    new Set(eligible.map(post => post.id)).size === eligible.length;
  const ids = new Set(eligible.map(post => post.id));
  const connected =
    valid && !!previous?.anchors.length && previous.anchors.every(anchor => ids.has(anchor.id));
  if (!valid || (previous?.anchors.length && !connected)) {
    return {
      connected: false,
      reference: previous?.anchors.length
        ? { ...previous, gapSince: previous.gapSince ?? previous.observedAt }
        : empty,
    };
  }
  const anchors = [...eligible]
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ id, postedAt }) => ({ id, postedAt }));
  return { connected, reference: { anchors, observedAt: scan.startedAt, gapSince: null } };
}
