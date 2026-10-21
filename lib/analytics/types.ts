/**
 * The custom events this API sends to Vercel Web Analytics. MusicNerdWeb's
 * `src/lib/analytics/events.ts` holds the full set and `docs/analytics.md`
 * describes them; add an event here when a ported route fires it.
 */
export type AnalyticsEvents = {
  profile_edit: {
    action: "link_add" | "link_remove" | "reorder" | "photo" | "vault_upload" | "dismiss";
    target: string | null;
  };
};

export type AnalyticsEventName = keyof AnalyticsEvents;
