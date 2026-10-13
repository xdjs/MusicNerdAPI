import type { RefreshCheckpoint, SocialScan } from "./types";
/** Only a completed account scan supplies coverage; individual posts never do. */
export function planSocialRefresh(
  checkpoint: RefreshCheckpoint | null,
  now = new Date(),
  lookbackDays?: number,
): SocialScan {
  const time = now.getTime();
  const valid = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= time
      ? Date.parse(value)
      : null;
  const checked = checkpoint && valid(checkpoint.checkedAt);
  if (checked && time - checked < 15 * 60_000)
    return { startedAt: now.toISOString(), skip: true, checkedAt: new Date(checked).toISOString() };
  const reference = checkpoint?.reference;
  const anchorFloor = reference?.anchors.length
    ? Math.min(...reference.anchors.map(a => Date.parse(a.postedAt))) - 48 * 3_600_000
    : null;
  const covered = checkpoint && valid(checkpoint.coveredThrough);
  const floor = lookbackDays ? time - lookbackDays * 86_400_000 : null;
  const after =
    anchorFloor !== null
      ? anchorFloor
      : covered
        ? Math.max(covered - 48 * 3_600_000, floor ?? -Infinity)
        : floor;
  return {
    startedAt: now.toISOString(),
    ...(reference ? { reference } : {}),
    ...(after !== null ? { after: new Date(after).toISOString() } : {}),
  };
}
