# #1660 bounded Dev acceptance

Manual Evals suite `discovery1660`, only with explicit approval for one disposable Dev fixture. Uses existing staging database secret, checks the supplied project fingerprint and actual `mnweb` login role before any insert. No model/provider credentials are provided and no discovery search is launched.

This is a real database/app-service persistence test using controlled replay of saved public Instagram/X handles, **not** an authenticated browser/HTTP, claimant, provider-accuracy or discovery-worker end-to-end test. The evidence explicitly marks replay observations, never asserts that a real search occurred. No original profile or existing user/claim is changed.

Run once, retain both evidence and cleanup artifacts. The exact fixture UUID/name is written before insert. A failed or uncertain insert is reconciled before export. Evidence must upload successfully before the separate cleanup step can delete the fixture. If any stage fails, inspect the exact fixture and retained intent before retrying; do not rerun blindly. Failure before creation has no fixture to clean. Keep the additive schema column after this test.

A successful result covers app-role evidence persistence, duplicate suppression, rejection/case/stronger-evidence preservation, automatic-attachment refusal, strict unknown-account authorization denial on a still-pending suggestion, explicit approval and reload, and duplicate-approval refusal. It does not establish external-provider identity accuracy or all UI/role acceptance.
