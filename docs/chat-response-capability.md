# Attributed passage response capacity

The request body remains strictly `{ messages }`. Updated Web advertises exactly:

```http
Accept: text/event-stream; musicnerd-attributed-text=12000
```

The API recognizes only that exact value. HTTP surrounding whitespace is normalized by `Headers`. Missing, unknown, combined, conflicting or altered values retain the legacy 6,000-character aggregate allowance. This is a presentation capability, never source authorization. One bounded value controls the selector instruction, tool limitation text and final stream admission for each request. Ordinary prose streaming is unchanged.

Updated Web accepts up to 12,000 literal UTF-16 characters in total. Individual PDF passages remain limited to 6,000 characters; text locators remain limited to 2,400. The existing limits of 24 passages, 65,536 serialized UTF-8 bytes and 2,048 characters per selector record remain independent. Publication, revision, withdrawal and original PDF checks are unchanged.

| Client                    | API         | Aggregate allowance                                  |
| ------------------------- | ----------- | ---------------------------------------------------- |
| Older or already-open Web | Updated API | 6,000                                                |
| Updated Web               | Older API   | 6,000; the API ignores the optional Accept parameter |
| Updated Web               | Updated API | 12,000                                               |

No new body property or custom header is required. The Accept value is under 128 bytes and contains no CORS-unsafe bytes; it does not add a safelist requirement. Cross-origin JSON requests already require the existing preflight. Authentication headers and `Cache-Control: private, no-store` are unchanged.

A partial or stopped response remains explicit. There is no automatic retry or repair. Follow-ups send validated navigation hints, not old quotations or raw PDF bytes; they must reread currently eligible originals. Retry uses the same capability header and starts a new answer using the existing lifecycle.

The existing evaluator defaults to legacy behavior. Its optional, bounded `attributedTextCharacters: 12000` input reproduces updated Web and records that choice as nonsecret request metadata. Invalid internal values fail before claim or dispatch. It does not enable a test, alter model budgets or authorize provider requests.

Larger excerpts are still selected passages, not a guarantee of relevance, support, completeness or a useful answer. This local contract must accompany the canonical endpoint documentation before publication.
