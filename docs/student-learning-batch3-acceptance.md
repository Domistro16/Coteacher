# Batch 3: improvement-data consent and event contract

Scope: a separate optional improvement-data purpose and a strict versioned training-event contract. Collection, feature production and export remain disabled. No evaluation harness, speech evaluation, local-model work, neural training or cross-school pooling is authorized here.

Acceptance criteria:

- Old profiles and guardian declarations never acquire improvement permission. Adults explicitly accept its notice; minors require purpose-specific guardian verification and independent relationship review. Personalization and external-AI choices remain independent.
- Withdrawing improvement permission excludes future improvement use and removes its derived-feature envelope, while retaining authorized private personalization. Full withdrawal also clears improvement permission/features. Restoring a backup excludes improvement use and drops its feature envelopes until renewed permission.
- The training-event schema has an explicit version, simulated-data marker, tenant-scoped pseudonymous identifiers, bounded outcome/context fields and no raw question text, audio, names or questionnaire answers. Unknown fields and wrong-school validation are rejected.
- No collector or feature producer is added. Fixed collection/export capability flags remain false, regardless of consent or environment configuration. No training export endpoint is added.
- Verify contracts/types, service/schema and restore tests, actual browser adult/minor consent/withdrawal flows, existing private endpoint/payload boundaries and relevant offline learning regressions. Label all issuer/provider/guardian/audio mocks honestly.

Status: Batch 3 is complete and submitted for review on
`feat/improvement-data-consent`. PRs #4 and #5 are merged into `main`; these Batch 3
changes remain on their own review branch. Collection and export remain disabled.

## Contracts and implementation

- `learner-profile` adds the optional `improvementData` permission and explicit
  improvement notice/acceptance metadata. Missing legacy values are declined.
  Omission by an old permission editor preserves an existing independent choice.
- Guardian requests distinguish `learning` and `improvementData`. A separate
  improvement request preserves existing learning permissions and answers, and
  needs its own verified declaration and independent authorized review. Existing
  approvals cannot activate the new scope.
- `school-state.privateLearners` reserves an encrypted improvement-feature slot
  and purpose exclusion/authorization metadata. Withdrawal deletes that slot,
  blocks old approvals and keeps separately authorized personalization. Restore
  drops improvement features/authorization and requires renewed permission. Old
  archives are not erased; no already-trained-model deletion is claimed.
- `training-event` / `ImprovementTrainingEvent` is a strict allowlist of versioned
  fictional outcomes and tenant-scoped pseudonymous references, UTC day, attempt,
  correctness and optional bounded school/lesson/measured connectivity context.
  No questionnaire answer is a context source. Validation rejects foreign schools,
  invalid dates, names/raw learner or event IDs/text/audio/answers and all unknown fields.
- `improvementDataAvailability` fixes collection, feature production and export
  to false. The event validator does not collect/project data; no producer,
  dataset builder or export endpoint exists. A future collector must implement
  keyed tenant scoping and undergo privacy/legal review. Shape validation does
  not establish anonymity and no cross-school dataset is pooled.

## Verified / mocked / not verified

| Area | Verified execution | Mocked / fictional | Not verified |
| --- | --- | --- | --- |
| Consent and withdrawal | Adult explicit notice, legacy default-off, independent scopes, purpose-specific guardian approval, replay exclusion, feature deletion and preserved personalization in `learner-service.test.ts`. | Fictional records, simulated guardian declarations and seeded encrypted legacy feature envelopes. | Actual guardian authority, real mailbox delivery, legal/operational consent suitability. |
| Backup restoration | Real local encrypted backup/restore drops the improvement feature slot and requires renewed permission, while keeping personalization. | Fictional local target and seeded feature slot. | Remote provider restore and historical archive erasure. |
| Schema and fixed gates | `improvement-data.test.ts` tests exact allowlists, forbidden fields, tenant/date/bound checks and disabled gates even with environment flags. HTTP tests reject collection/export endpoints. | Manually constructed fictional events; in-process HTTP transport. | Semantic anonymity or a real event projector/collector/exporter; none is enabled. |
| Browser consent | New adult and minor Chromium flows pass, including reload, independent withdrawal, separate declaration and operator review. All nine school scenarios pass, retaining actual offline reopening, isolation and source-grounded help. | Fictional accounts, simulated links/operator, synthetic recording and mocked preparation/tutor. | Real children, hosted identity/real TOTP, real guardian or physical microphone verification. |
| Access/payload boundaries | All four privacy-browser scenarios pass, including 35 adult private-operation denials, school-scoped reviewers, revoked cookies, cache/export checks and the new improvement withdrawal route. Unit HTTP/payload assertions pass. | Injected identity/provider transports; no external AI calls. | Provider-side retention, semantic non-disclosure, malicious same-origin code and all browser sinks. |

Current checks: generated contracts/types clean; 45 unit files / 562 tests pass;
three isolated account builds pass; 9/9 school and 4/4 privacy browser scenarios
pass, with no skips. The final contract/type recheck and whitespace checks pass. The original
46-scenario demo suite was not repeated for this batch; its earlier results are
historical. No evaluation harness, training, speech/local-model work, pooling or
private-fixture/env access has been performed. The user subsequently authorized
committing Batch 3 and opening a pull request for review; it has not been merged.

Review the scope and contracts above, then `tests/improvement-data.test.ts`, the
new consent/withdrawal cases in `tests/learner-service.test.ts`, the restore case
in `tests/school-backup.test.ts`, and `tests/e2e/school-improvement-data.spec.ts`.
Current browser JSON reports are in this worktree's
`.task-tmp/batch3-{school,privacy}-browser.json`. Builds used
`scripts/build-isolated-acceptance.mjs account .task-tmp/batch3-account` with project
env loading disabled. Both browser configurations used that isolated build root;
no configured service or normal build output was replaced.
