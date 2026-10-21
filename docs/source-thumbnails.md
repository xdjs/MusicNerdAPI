# Source page thumbnails — Web #1583

Website Lore thumbnails come from the specific linked page, never an account avatar or another artist's branding. The API preserves the page preview image during onboarding insertion and during durable approved-source extraction. The existing page-image parser prefers usable HTTPS Open Graph metadata, falling back to HTTPS Twitter image metadata. Unsafe, credential-bearing, nonstandard-port and unsupported image URLs are ignored; no image download or extra provider call is introduced.

Durable extraction parses metadata from the same bounded, DNS-pinned, redirect-validated HTML response as the source text. The existing ownership, source URL, approval and job-cursor locks govern persistence. Fill a missing image only; do not overwrite existing source artwork. Blocked, empty or failed responses do not attach images. Existing rows with text but missing artwork are not backfilled by this change; any correction of those rows requires a separately reviewed explicit refresh.

The existing source response includes ogImage and Web's Lore renderer displays it. Missing or broken images use the site's favicon/neutral gradient. This is metadata support, not a promise to match Apple's caching or proprietary preview extraction. No schema migration is needed.
