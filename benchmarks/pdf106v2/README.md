# Four-answer paired PDF comparison

The user approved exactly four answers: alias and preservation questions once each on baseline 277e8eb and candidate 4fa7c2f. Both use the identical adapter, existing Gateway model, 2,048-token output cap, original 13/19-page PDF hashes and isolated source/allowance rows. Real claims and sources are not modified. The earlier three-answer grant is exhausted and its workflow mode is removed.

Manual mode pdf106-four-paired runs baseline alias, candidate alias, candidate preservation, baseline preservation. A shared version-4 durable ledger limits submissions to four and model egress to 24, with zero web calls or paid judge. Failures and uncertain submissions count, stop the run and cannot be replaced. Permanent per-case markers reject repeats; Actions retries are refused. No other suite is selected by this dispatch. The count limit is not a dollar cap.

The separate read-only preparation step downloads only two approved known originals with the existing staging connection and verifies exact bytes/hash. Answer steps receive only the existing Gateway credential and work against isolated PGlite rows. Citation URLs are fixture-only, not public deployed acceptance.

Offline tests exercise the actual handler, SQL, SDK native-file serialization and original-PDF reader without external network. Live records include tool events, token usage, UI text timestamps, SDK text-event timestamps and transport request/header/first-raw-chunk timings. First raw transport chunk is not necessarily a model text token. No source bytes or secrets are retained in telemetry.

No reruns or additional paid answers are authorized after this comparison. Docs remain unpublished; no merge or production promotion.
