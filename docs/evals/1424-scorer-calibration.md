# Scorer calibration cases from the October 29 diagnostic

These are manual gold judgments against the exact captured passages in [experiment 89f689f](https://www.braintrust.dev/app/xDJs/p/music-nerd/experiments/chat%20%C2%B7%20anthropic%2Fclaude-sonnet-5.5%20%C2%B7%2089f689f). They are development cases, not held-out acceptance. No model was rerun or score overwritten. Use the original exported answer/evidence snapshots, not current webpages; retain their content hashes. Do not claim a mocked scorer test demonstrates these judgments.

| Case / claim to audit | Required judgment | Captured support boundary |
| --- | --- | --- |
| dutchyyy-aliases: 2004 solo album under Dutchmassive | Unsupported by cited [3] | [3] discusses platform names and rebranding, not that album/date. Hash `1adf5abeda1366a538f7d049ecb94291020a05b75a891f2663f59f70200c19d2`. |
| dutchyyy-aliases: rebranded Dutchy to Dutchyyy after artist-page collisions | Supported by [3] | Same snapshot explicitly describes the collision, rename and loss of followers/stats. This positive control prevents treating every extra fact as wrong. |
| willie-colon-blades: guest on a Lavoe-led record rather than co-star | Unsupported by captured passages | [2] names the collaborating musicians, but does not establish guest/lead roles. Hash `85f1c21cf2097427bda166812ff11b8ff3dbb3819a9abbc306d70d523cc6b34f`. The automated judge gave 100%; this is a known false positive. |
| willie-colon-blades: Metiendo Mano!, 1977 | Supported by [1] | The captured review explicitly supplies the year and first-collaboration description. |
| bio-ritmo-singer: Puerto Rican origin attached to [4] | Citation-placement gap | The fact appears in [2], not the cited [4] snippet. Support elsewhere in the input must not silently repair a misplaced citation. |
| willie-colon-death: exact date attached to [5] | Citation-placement gap | [5] supplies Saturday/age, but not the calendar date in captured text. [2] does contain it. Do not import unseen page metadata. |
| dutchyyy-onchain: September 2024 post date | Unsupported by captured [1] text | A URL or an external page may have date metadata; the captured passage does not. The preservation motive itself is supported. |
| bio-ritmo-puerta-del-sur: Vampisoul, 2014 | Supported by [1] | The band's captured discography supplies both. Hash `eff2a5e88c6dd1efd4ea170d720a04b6c7aa0d98fcb5802b511fb44c26e37678`. |

A future scorer revision should explicitly identify each unsupported clause and its citation before assigning a summary score. Assess it on these known cases and separate held-out examples under a newly approved bounded run. Until then, keep manual review mandatory and retain `cited-evidence-v1` results as recorded. Do not fold PDF evidence into this text-only contract; coordinate an explicit adapter with API #106 / PR #108.
