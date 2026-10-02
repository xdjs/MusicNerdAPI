# Social research

`social_ingest` is advanced by the existing `/api/research/advance` route and minute cron. No new endpoint, migration or browser-triggered scrape is introduced. Stored artist handles are the only profile inputs. Instagram collection remains unchanged; after it finishes (or is disconnected/already stored), the same job reads TikTok, X and selected Instagram reel audio before queuing caption extraction.

| Source | Actor | Limit | Run charge cap |
| --- | --- | --- | --- |
| TikTok | `clockworks/tiktok-scraper` | 50 latest profile videos | $0.50 (actor minimum cap) |
| X | `apidojo/tweet-scraper` | 50 latest own posts, excluding reposts | $0.05 |
| Instagram audio | `apify/instagram-reel-scraper`, `includeTranscript: true` | Three own reels with captions under 160 meaningful characters, known duration at most 180 seconds | $0.50 |

The Instagram feed actor remains `apify/instagram-scraper`: it returns caption/video metadata, not audio transcripts. The dedicated Reel Scraper supports audio transcription as a paid add-on. Native transcript availability and quality are not guaranteed. Unavailable or failed enrichment is recorded privately in job state; other sources and existing caption research continue. Retry status/data reads against the same saved run and dataset. Never restart a paid run after it has an id.

TikTok/X items normalize into `artist_social_posts`. Wrong owners, reposts, error placeholders, malformed dates and off-platform URLs are rejected. A stored Instagram post must match the selected post id, owner and canonical shortcode before its audio transcript is attached. Raw payloads and transcripts stay server-side. All writes use the existing job/artist lock and revocation guard.

Successful Instagram transcripts are stored separately in `raw._musicnerdTranscript`, with actor, run id and retrieval date. They survive a feed refresh. The Lore receives bounded transcript excerpts as explicitly labelled audio context with original post citations. Audio is not automatically attributed to the artist: lyrics, sampled speech and other speakers are not artist statements or collaborator credits. Caption extraction still verifies quotes only against captions. TikTok/X captions use the same exact-quote checks as Instagram.

The extraction handoff marks newly collected audio so Lore is rebuilt even if incremental caption reading has no unread captions. Invalid job state fails before any paid run. Starting a provider run is preceded by a durable intent marker; an ambiguous lost response requires provider inspection rather than another paid start. Optional status/collection reads have four attempts against the same run/dataset.

Existing Update Latest remains an Instagram collection-only job. TikTok/X data enrich research and Lore; this change does not add their cards or refresh controls to Latest. Existing in-flight Instagram jobs finish their saved dataset before the additional stages. A per-platform existence check prevents Instagram data from suppressing first-time TikTok/X collection. Forced research refresh repeats capped profile reads, but skips reels with saved transcripts.

Provider references checked 2026-10-02: [Instagram](https://apify.com/apify/instagram-scraper), [Reels input](https://apify.com/apify/instagram-reel-scraper/input-schema), [Reels output](https://apify.com/apify/instagram-reel-scraper/output-schema), [TikTok](https://apify.com/clockworks/tiktok-scraper), [X](https://apify.com/apidojo/tweet-scraper). X documents a 50-item minimum; use 50, not a nine-post Latest limit. Apify's charge caps can stop a run before its requested item count.
