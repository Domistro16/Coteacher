# Student learning extension acceptance

The application workflow has fictional-data functional evidence. Passing those
journeys does not complete a predictive student-model foundation or establish
learning effectiveness, semantic privacy, managed deployment or production safety.
The earlier statement that all combined-plan milestones were complete was too broad.

## Batch status

- Batch 1: claim corrections, roadmap and schema-first TypeScript student-model
  baseline/private device decision ledger implemented and functionally verified.
  Approved by the user after review; this does not complete later gates.
- Batch 2: signed-in teacher/admin/other-school denial matrix, export/cache checks
  and broader outbound-payload assertions implemented. The detailed evidence,
  mocked dependencies and regression record are in
  [Batch 2 privacy acceptance](student-learning-batch2-acceptance.md).
- Batch 3: improvement-data consent and allowlisted training-event schema await
  review. Improvement-data collection and export are not enabled.
- Evaluation harness, speech evaluation, broader interface refactor and further
  local-model work have not started and require separate approval.

## Verified / mocked / not verified

"Verified" below is limited to the stated test environment. A real browser can
exercise real application behavior while using synthetic audio or mocked providers.

| Area | Verified | Mocked / simulated | Not verified |
| --- | --- | --- | --- |
| Onboarding and settings | Actual Chromium forms, draft reload, editing, optional decline, withdrawal and narrow/desktop layout in school-onboarding.spec.ts. | Fictional accounts, local identity/repository; no real guardian. | Human two-to-three-minute completion target; managed signup/mailbox/MFA end to end. |
| Guardian lifecycle | Token hashing/expiry/reuse/declaration and independent reviewer checks in learner-service.test.ts; actual simulated-token browser flow and independent school/operator review. | Resend transport and Supabase issuer tests; simulated links explicitly do not verify real mailbox control. | Real mail delivery, real guardian authority and operational/legal suitability. |
| Offline learning | Actual downloads, browser offline reload, local media playback, help/checks, two learners/two lessons, shared switching and reconnect receipts. Tests count zero window.fetch attempts to /api/ on their core paths, including navigator.onLine=true. | Synthetic recording; fictional users; mock preparation/tutor in school suites. | Exhaustive network-attempt instrumentation across WebSockets, workers, XHR, beacons and all origins; physical Android/OS behavior. |
| Private profile access | Batch 2 Chromium matrix: 30 adult private endpoint denials, other-learner ownership, other-school lesson denial, school-scoped reviewer metadata and revoked-cookie replay rejection. Actual SDK, secure cookies, local HTTP and persistence; student sign-in form exercised. | Identity issuer and AAL1/AAL2 claims injected; fictional identities and schools. | Hosted identity/MFA setup, real TOTP and deployed proxy/cookie configuration. |
| Private storage and deletion | PIN/AES-GCM paths, owner checks, actual IndexedDB reopen/switch and optional row removal retaining lesson/progress/other learner; local encrypted backup restore includes server profile envelopes. | Fictional records and local restore target. | Separate provider-target restore; immediate deletion of disconnected copies or historical backups; restoration of device-only decision logs from a server backup. |
| Provider payload boundary | Historical actual selected-marker inspection; Batch 2 executes answer/follow-up/check, speech, transcription FormData and live-setup serializers and asserts nested field projections. Raw decision reasons/evidence IDs are excluded from external checks; live lesson context has three fields. | All Batch 2 provider transports/responses/audio; no new real provider/model calls. Existing withdrawal/outage races use mocks. | Semantic privacy of question/history/audio/SDP, provider-side retention, actual live negotiation; optional local adapter parity remains under separate approval. |
| Exports and browser caches | Batch 2 actual school/teaching DTO checks and encrypted demo download with separate private IndexedDB memory; wrong PIN rejected. A planted stale API response is bypassed after account switch; private success/error responses are `no-store`, and new API responses stay outside static CacheStorage. | Fictional encrypted memory and stale-cache fixtures; real browser encryption, storage and download paths. | Exhaustive browser sink coverage, disconnected-device remote deletion or malicious same-origin code protection. |
| Teacher-visible content | Structured profile/private decisions are excluded from teacher memory and progress exports; generated-answer instructions and explicit-disclosure guard have tests. | Adversarial generated strings in unit tests. | A guarantee that generated text cannot paraphrase permitted preferences. Voluntary question/conversation details can reach teacher oversight. |
| Grounding and matching | Source-reference/exact-quote validation; teacher review UI; prepared match and honest unsupported queue; source revision invalidation tests. | Small fictional corpus, mock generated browser candidates. | Independent broad factual accuracy, corpus-wide no-match precision, general curriculum coverage or learning gains. |
| Student model, Batch 1 | Versioned input/output/decision schemas; TypeScript Bayesian evidence-count baseline, model adapter and private device ledger; current checks recorded below. | Synthetic assessment sequences are plumbing tests only. | Predictive accuracy, calibration, real learner understanding, subgroup performance, learned-model replacement or a consented outcome pilot. |
| Speech | Actual bundled MP3 decoding/playback with networking disabled; earlier actual OpenAI speech requests. | Browser recognition controls, synthetic microphone source and mock connected speech in browser suites. | Open-source STT/TTS evaluation, current-build physical microphone/recognition/intelligibility and accent/language suitability. Earlier human rehearsal reports apply to their tested builds. |
| Local text benchmark | Actual pinned llama.cpp/Qwen calls with measured timing/memory. Model rejected and disabled. | Six fictional question cases, not learner performance data. | Valid grounded-accuracy estimate or comparable cost per accepted answer versus external generation. |
| Deployment/release | Existing public-config/bundle/anonymous-route checks and local app regression. | Fictional local acceptance identities. | Hosted deployment, real-child release, complete legal review, provider restore and production security certification. |

## Batch 1 model behavior and limits

The StudentModel boundary is synchronous and network-free. Beta(1,1) plus n
eligible distinct first checks (c correct) produces `(c+1)/(n+2)` for both the
response-based understanding proxy and next-check probability. It does not
separately estimate mastery, guessing or difficulty. Confidence `n/(n+10)` means
evidence adequacy. Below 0.5 the predictor abstains; cold start returns the neutral
prior and zero confidence. Approved defaults, explicit choices/accessibility and
direct incorrect-answer support remain available. No model numbers appear in the
learner interface, teacher views or language-provider payloads.

The current two-lesson fixture revisits the same assessed content, so it does not
reach ten distinct checks per concept. The browser journey verifies abstention,
direct corrective support and the ledger. The eligible prediction-routing branch
and replacement-model behavior are covered by synthetic unit inputs only.

Actual selected visuals generate private decision records; rendering and media
position updates do not. Records include model version/output, source references,
reason and evidence/selection IDs in the encrypted device memory row. Retention
matches the five-completed-lesson/90-day window, with unfinished work within 90
days and a 1,000-record cap. Withdrawal clears them on device participation.
Old memories without the optional fields remain readable; legacy assessment
records without item provenance do not increase model confidence.

The expanded browser check also exposed a completion-ordering race. Finishing is
saved locally; the existing background return now sends completion only after a
validated progress receipt. The server still rejects completion without received
progress. A controlled-delay browser assertion checks this order.

The ledger is currently device-local. Existing reconnect merges preserve it, but
there is no new server-upload or analytics endpoint; server backups cannot restore
lost device-only decisions. This is private personalization, not training consent
or an allowlisted training export. See [replacement gates](student-model-roadmap.md).

## Regression records

Historical application checks before Batch 1: 41 unit files / 518 tests; all three
production builds; demo package validation; full original explicit-mock browser
run 45/45 (10.7 minutes), school suite 7/7 (2.7 minutes). These counts do not verify
new Batch 1 changes.

| Historical Batch 1 check | Result and scope |
| --- | --- |
| `npm.cmd test` | PASS: generated contracts current, TypeScript clean, 43 files / 530 tests. Final run uses `envDir:false`; network is disabled in unit setup. |
| Three account production builds | PASS with the normal app configs, programmatic Vite `envDir:false` and the explicit proxy env-file bypass, in isolated output folders. Configured services and normal preview output were not replaced. |
| Three isolated demo builds | PASS with the same env-file restrictions; student/teacher demo mode and school production mode. |
| School browser suite | PASS: all 7 scenarios in one final run (2.7 minutes), including the private ledger, cold-start abstention, media-tick deduplication, delayed progress/completion ordering and withdrawal/explicit-choice separation. Actual Chromium/IndexedDB/local service; synthetic microphone and mock providers. |
| Demo package pipeline | PASS: valid simulated light/refraction package. |
| Original demo browser suite | PASS: all 45 scenarios in one complete run (12.6 minutes), no skips, against isolated demo builds with explicit MockTutor. Native capture/encoding/playback are exercised with synthetic microphone input. |
| `git diff --check` | PASS; existing Windows line-ending warnings only. |

New focused unit evidence is in `tests/student-model.test.ts` (cold start, Beta
updates, threshold, first-attempt/scope/time filtering, disabled processing,
replacement contract, invalid output and outage fallback) and
`tests/learning-engine.test.ts` (retry/content identity, private encrypted records,
selection deduplication, retention/withdrawal and adapter precedence). Browser
ledger assertions are in `tests/e2e/school-learning-engine.spec.ts`. These are
functional plumbing checks, not calibration/accuracy/effectiveness measurements.

No live provider calls, new local-model run or speech evaluation were performed
for Batch 1. No neural training, runtime pyKT/pyBKT, pooling, commits, private
fixture edits or env-file edits were made. The acceptance build/harness bypasses
private env-file loading and external configured storage/identity. This batch did
not restart or migrate configured services. Batches 2/3 and all separately gated
evaluation/refactor work remained unstarted at that checkpoint. Batch 2 now has
its separate [verification record](student-learning-batch2-acceptance.md); Batch 3
and the separately gated milestones remain unstarted.

## Earlier real integration evidence (not rerun by Batch 1)

- [Two-learner browser evidence](student-learning-browser-evidence.json): four
  downloads, zero counted offline API fetches, distinct support, optional-memory
  removal retaining lesson/progress and the other learner. Provider is a mock;
  recording is synthetic Opus.
- [Actual OpenAI evidence](student-learning-provider-evidence.json): six HTTP 200
  requests: two replies/follow-up, two speech requests and two reusable generated
  candidates kept draft. Preparation took 4,951 ms; support was 8,006 bytes. Four
  text responses used 4,999 input/707 output tokens total. No complete currency
  cost, per-answer latency or provider memory measurement was recorded. Scripted
  fictional actor IDs are not a managed-browser identity proof.
- [Actual local benchmark](local-model-benchmark.json): Qwen3-0.6B Q8_0 on pinned
  llama.cpp b12032 CPU, four threads/context 2,048; model 639,446,688 bytes, peak
  working set 1,185,869,824 bytes (about 1.10 GiB). Six requests took 12.346?16.352 s
  (mean 14.219 s). Zero of three supported cases passed exact-citation validation;
  all six outputs were rejected. This is not a grounded-accuracy percentage or
  model-level no-match competence. Zero external calls does not imply zero local
  cost. No local/external cost-per-accepted-answer comparison exists.

For browser reproduction use tests/e2e/README.md. The original tutor scenario
requires COTEACHER_TEST_TUTOR=mock; otherwise that scenario skips. Run expensive
checks sequentially and label synthetic/provider behavior honestly.
