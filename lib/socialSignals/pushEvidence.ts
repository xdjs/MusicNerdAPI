import { MAX_EVIDENCE_URLS } from "@/lib/socialSignals/const";

/**
 * Adds a post URL to a signal's evidence, once, up to the cap.
 *
 * @param urls - The signal's evidence URLs, changed in place.
 * @param url - The post the signal was read from.
 * @returns Nothing.
 */
export function pushEvidence(urls: string[], url: string): void {
  if (urls.length < MAX_EVIDENCE_URLS && !urls.includes(url)) urls.push(url);
}
