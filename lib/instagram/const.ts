export const APIFY_RUNS_URL = "https://api.apify.com/v2/acts/apify~instagram-scraper/runs";
export const APIFY_RUN_URL = (runId: string) => `https://api.apify.com/v2/actor-runs/${runId}`;
export const APIFY_DATASET_URL = (datasetId: string) =>
  `https://api.apify.com/v2/datasets/${datasetId}/items`;
/** Starting a run and reading its status are quick calls; only the scrape is slow, and we never wait for it. */
export const APIFY_CONTROL_TIMEOUT_MS = 20_000;
export const APIFY_DATASET_TIMEOUT_MS = 15_000;
export const DEFAULT_SCRAPE_LIMIT = 200;
/** Hard ceiling regardless of what a caller asks for: apify/instagram-scraper bills ~$2.70/1,000 results. */
export const MAX_SCRAPE_LIMIT = 300;
/** A worker invocation has sixty seconds. At most nine thumbnails (three concurrent, nine seconds each) fit alongside collection and DB work. */
export const THUMBNAILS_PER_SLICE = 9;
export const THUMBNAIL_MAX_BYTES = 8 * 1024 * 1024;
export const THUMBNAIL_TIMEOUT_MS = 9_000;
export const VAULT_BUCKET = "vault-files";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
