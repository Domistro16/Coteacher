# Student onboarding and Coteacher learning engine handover

Prepared 1 November 2026. Workspace: `D:\coteacher`, Windows PowerShell.

## Latest implementation checkpoint (2 November 2026)

The application workflows below have fictional-data functional evidence. This is
not completion of the student-model foundation: the read-only audit found missing
estimation/prediction contracts, training consent/events, evaluation and release
gates. Batch 1 now adds a transparent, unvalidated student-model baseline and
private device decision records; current verification is in
`student-learning-acceptance.md`. Batch 2 now adds browser access/export/cache
checks and broader external-provider serialization assertions; see
`student-learning-batch2-acceptance.md` for verification and limits. PRs #4 and #5
were merged, in order, on 2 November 2026. Batch 3 adds independent improvement
consent, withdrawal/restore exclusions and an allowlisted event schema, with
collection/export still off; see `student-learning-batch3-acceptance.md` for review.
Evaluation, speech
assessment and trained-model replacement are not implemented or authorized here.
The original inspection checkpoint below is historical and superseded.

Batch 1 was approved after review. Its final checks: current generated
contracts/TypeScript, 43 unit files / 530 tests, three account builds and three
demo builds, package pipeline, school browser 7/7 (2.7 minutes) and original demo
45/45 (12.6 minutes), no skips. Real Chromium/IndexedDB/local HTTP exercised the
private ledger and offline behavior; learners/microphone/providers were fictional
or mocked. High-confidence prediction routing is covered by synthetic unit inputs
only. There is no predictive-performance/calibration claim and no new live API,
speech or local-model evaluation. See `student-model-roadmap.md` for proposed
replacement gates and `student-learning-acceptance.md` for the evidence table.

Batch 2 uses actual Chromium, SDK session revalidation, secure browser cookies,
local HTTP and persistence with a mocked identity issuer/AAL claims. The private
learning route rejects adults before progress checks, the static worker bypasses
API cache lookup, and external serializers project allowed fields. This is not
hosted identity, real TOTP, provider retention or semantic de-identification
verification. No local-model or speech evaluation was run. Batch 3 has a separate
implementation/review record; the separately gated milestones have not started.

Batch 2 verification: 44 unit files / 533 tests; 4 privacy, 7 school and 46 demo
browser scenarios, no skips; three account and three demo builds. Browser
encryption, IndexedDB, exports, cache boundaries and HTTP role gates execute for
real. Identity issuance/MFA assurance, provider responses and microphone input
are fictional or mocked. The full scope and remaining deployment/local-adapter
limits are recorded in `student-learning-batch2-acceptance.md`.

The new `student-model-input`, `student-model-output` and `student-decision`
schemas back `packages/shared/src/student-model.ts`. The baseline is Beta(1,1)
plus distinct first checks, with low-confidence abstention. Existing support
callers use adapters. Actual support selections persist privately on the device,
with five-lesson/90-day retention, a 1,000-record cap and withdrawal clearing.
This is not a new server ledger/upload. A completion-ordering race found during
browser verification was corrected: completion now follows a progress receipt.
Do not start evaluation, speech, broader interface refactoring or
local-model work until the user approves the next step. Configured services and
private fixtures/env files were not edited or migrated by this batch.

- Strict generated contracts, encrypted private profiles/memory, age-first adult
  and guardian-assisted registration, independent guardian review, editable
  preferences and placement requests are implemented. Legacy declarations are
  not verified guardian consent. Simulated tokens and email tokens are distinct.
- Private offline memory has a separate PIN-encrypted row and a validated owner
  reference in lesson snapshots. Settings can remove it without deleting lessons,
  media or progress. Clearance timestamps prevent old evidence from returning
  after optional processing is re-enabled.
- Reviewed mappings, bounded reusable question/explanation preparation, exact
  source-quote checks, immutable approved publication support, personalized
  recorded visuals and individual offline help decisions are implemented.
- The two fictional lessons are the original light/refraction lesson and a
  bounded follow-on lesson revisiting its objective. No arbitrary curriculum or
  learning-effectiveness claim is made.
- Real OpenAI sourced replies/follow-up and reusable draft preparation passed in
  an isolated local fixture, with projected preferences, excluded private fields,
  token usage, latency and request IDs recorded. See
  `student-learning-provider-evidence.json`; no populated database/bucket or
  obsolete saved teacher credentials were used.
- Actual llama.cpp b12032 / Qwen3 0.6B Q8_0 evaluation completed. It was rejected
  for source/safety failures and remains disabled. Model/runtime downloads have
  pinned checksums and a model licence in ignored `.task-tmp/local-model`. The
  benchmark process was stopped. See `local-model-benchmark.json`.
- Resend delivery is implemented but unconfigured and mocked in tests; no real
  guardian email was sent. Real-child rollout, hosted deployment, provider-target
  restore and physical phone/microphone checks remain deferred/unverified.
- Historical application regression before student-model Batch 1 passed: 41 files / 518 tests, and
  the demo package pipeline passed. All three normal production builds passed.
  The final school browser run passed 7/7 scenarios (2.7 minutes), and the original
  demo passed 45/45 in one full explicit-mock run (10.7 minutes), with no skips.
  A final real-provider rerun passed all six requests after privacy hardening.
- Final privacy hardening prohibits model disclosure of preference values and
  rejects explicit profile/preference disclosures in answers/checks before
  retention or speech. The deterministic guard does not prove semantic privacy
  for every possible generated sentence; voluntary conversation remains visible
  in existing teacher oversight.
- Earlier normal-account preview checks used student `http://127.0.0.1:5173`, teacher
  `http://127.0.0.1:5174` and school `http://127.0.0.1:5175`. Public config/bundle
  checks passed after the earlier task-owned backend restart. Current availability
  is not rechecked by Batch 1, which does not load private env files or restart
  configured services. No managed login is inferred from those read-only checks.

## Original inspection-only checkpoint (superseded)

The user approved the combined plan below and explicitly instructed: **“Implement the plan.”** Implementation remains authorized. The latest request is to write a handover for the next chat, including the full plan.

**Implementation has not started.** The implementation turn completed repository inspection only before it was interrupted. No onboarding schemas, application changes, new dependencies, model downloads, migrations or tests have been created/run for this feature. This handover is the only file created by this handover task. Do not mistake the extensive existing modified/untracked files for new onboarding work.

No implementation command is awaiting continuation from the interrupted turn: its tool calls were completed reads/searches. Do not reuse historical process/session handles. Discover current app availability before assuming servers are running.

The prior school-registration PC milestone is complete. Read the **latest checkpoint** at the top of [handover-school-registration.md](handover-school-registration.md); its lower historical sections contain superseded incomplete statuses and blockers. Do not restart completed registration/recovery/media work.

No new goal object was created for onboarding. Do not claim the prior completed school goal is still active. A goal tool is not required to continue the implementation request.

## Authorization, decisions and boundaries

- First target: **current PC**, proving preparation, individual adaptation and offline delivery before paying for hosted capacity.
- Shared learning: **individual evidence first**. Share approved content and algorithms; pooled cross-school model training is deferred.
- Consent: build **verified consent readiness**, with real-child collection disabled until operational/legal release checks.
- Guardian verification: **email verification plus authority declaration plus school relationship review**, or operator review for unaffiliated learners. Mailbox verification alone is not parental authority.
- Interests: connected, source-checked examples; offline selects existing reviewed variants. No new themed offline-authoring workstream by default.
- Adaptation: explicitly authorized **across lessons**, extending the older sprint limitation.
- External AI: relevant teaching preferences **and confidence/study-support signals** may be disclosed with permission. Structured identity, age, guardian details and private comfort scores are excluded. Voluntary question/history/audio/source text can still contain identifying details; this is not semantic de-identification.
- Unsupported capabilities: save preferences honestly; do not imply translations, teacher-audio captions, reminders or full exam-practice already exist.
- Hosted deployment/testing and a separate provider-target restore drill remain deferred by the user.
- No real children's data. Simulated fixtures must carry `simulated: true` and be labelled in UI/evidence.
- No fixed learner-style/personality labels or hobby-to-reasoning inference. Personalization changes the route, never the objective.

The user described a shared “big brain” that understands each learner, anticipates questions, prepares explanations, and reduces reliance on external AI for speed and cost. The agreed implementation is a modular engine with replaceable models, not training a gigantic model from scratch. Individual state updates immediately; global algorithm/model updates are evaluated and released deliberately.

## Working rules and preservation

Read `AGENTS.md`, `docs/product-brief.md`, `docs/architecture.md`, `docs/scope.md`, `docs/contracts.md`, `docs/matcher.md`, `docs/demo-acceptance.md`, `docs/safety-and-data.md`, and `docs/hackathon-experience-rules.md` before relevant changes.

- Schemas first, generated types second, code third.
- Use bounded vertical tasks, each with acceptance criteria and meaningful tests.
- Explain/update the older cross-lesson scope restriction before implementation. This conflict was already communicated to the user: the approved plan extends the scope. No further permission is required for that change.
- Preserve the existing continuous teacher-recording/student-player/tutor journey, synchronized native playback clock, offline assets, sourceRefs, safe activities, honest no-match and school authorization.
- The tree contains extensive prior work. Do not reset, clean, delete private fixtures, overwrite unrelated changes or make a commit without a request. Do not create `PROMPTS.md`.
- Do not spawn agents unless the user or applicable instructions explicitly request delegation.
- Use `npm.cmd` on this PowerShell environment. Node requirement is 22.12+.
- Do not read/print `.env` or `.env.local` wholesale. They contain configured providers and keys. Do not print tokens/cookies/passwords or include them in docs/chat.
- `.task-tmp/provider-acceptance/*` contains private seeds and sessions. The teacher password was manually changed; the saved fixture may be obsolete. Do not repeatedly retry its old password or ask for a password in chat.
- `.env.local` is the populated source database/bucket, **not** an empty restore target. Never clear it for testing.

## Full approved combined implementation plan

### Summary

Build short, editable onboarding connected to a learning engine that continually adapts the teacher's lesson to each student. Coteacher owns learner memory, content selection and adaptation decisions; local or external AI models provide content generation through a replaceable interface.

Prove the complete experience on the current PC with simulated learners first. Share approved content and algorithms across students while keeping personal evidence separate. Preserve the teacher's learning objective, source grounding and offline student experience.

### 1. Signup, consent and preferences

- Ask whether the learner is under 18 before collecting the remaining questionnaire. Store an age band, not date of birth.
- Support school-issued accounts and guardian-assisted signup. For minors, require guardian email verification, an authority declaration and school confirmation of the relationship; unaffiliated learners require operator review. Email verification alone does not establish parental authority.
- Record essential-processing authorization, optional personalization and external-AI permissions separately. Declining optional processing must preserve approved basic learning.
- Use single-use, expiring verification tokens stored as hashes. Record notice versions, approved scopes, verification methods, review decisions and withdrawal. Default pending requests to seven-day expiry.
- Keep real-child collection disabled until legal and operational release checks approve the workflow. Existing checkbox consent must not silently become verified consent.

Present four short screens: **About you**, **Helpful explanations**, **Listening and questions**, and **Review**. Target two to three minutes of student interaction, excluding guardian review.

Required questions cover:

- Preferred name, class, subjects, language and English reading ease.
- Up to two helpful explanation formats, explanation length, listening/reading preference, usual response to confusion and preferred speak/type input.

Comfort asking questions remains optional. Provide “not sure” where appropriate and save completed steps. School-approved class and subject placements remain authoritative; student changes become requests rather than access grants.

Offer interests, aspirations, subject confidence, feedback preferences, study habits, accessibility and goals through editable **My learning preferences** settings. During the first three completed lessons, show at most one dismissible optional prompt per lesson. Separate study environment from device sharing.

Explain why answers are collected. Allow optional answers to be removed and personalization disabled. Do not collect diagnoses, personality labels, income, religion, family occupations or exact addresses.

### 2. Learning engine and content preparation

Build five cooperating components:

| Component | Responsibility |
| --- | --- |
| Lesson knowledge | Versioned teacher-approved concepts, prerequisites, sources, explanations, activities and checks. |
| Learner memory | Private preferences and evidence of understanding across relevant lessons. |
| Adaptation engine | Select next approved explanation/check and record an understandable reason. |
| Preparation engine | Anticipate useful questions and prepare reusable grounded content before download. |
| Model gateway | Route permitted generation to a local model or configured external provider. |

Extend the existing matcher, personalized replay, tutor memory and provider interface. Keep current playback clock, recording and offline storage behavior.

Preparation flow:

`Teacher materials -> concept/prerequisite mapping -> candidate questions and explanation variants -> source/safety checks -> teacher review -> versioned publication -> individual download selection`

- Generate reusable content per approved lesson revision, rather than a complete new lesson per learner.
- Anticipated questions are candidates, not guaranteed predictions. Rank them by concept coverage, likely misconceptions and individual evidence.
- Package selected answers and approved alternatives within an explicit size budget.
- Scope reusable caches by school/content authorization, lesson revision, source revision, language and generation configuration. Never reuse private conversations as shared answers.
- Invalidate derived content when approved sources change.
- Source-reference validation checks references, not factual correctness; retain teacher review for reusable publication.
- Interest-based examples initially belong to connected tutoring. Offline personalization selects reviewed variants; expanding offline themes requires preparation/review.

### 3. Adaptation and technical contracts

Implement versioned schemas first, then generated types and code for onboarding, consent verification, learner evidence, adaptation decisions and prepared-content metadata.

Add authenticated student profile read/update/complete/reset operations, bounded guardian verification/reviewer operations, and interfaces for:

- Updating learner evidence from validated events.
- Selecting approved support with a reason and evidence references.
- Preparing/publishing reviewed lesson support.
- Generating answers through interchangeable local/external providers.

Keep private questionnaire records separate from school account snapshots, teacher-readable tutor memory and progress exports. Encrypt private records, enforce learner/school boundaries, and include them in backup/deletion workflows.

Decision rules:

- Accessibility settings/current explicit choices take priority over inferred preferences.
- Relevant assessed behavior outweighs signup guesses as evidence accumulates.
- Reading ease/confidence affect scaffolding, not curriculum access or objectives.
- Pauses/replays are contextual signals, not proof of confusion.
- Comfort answers may shape gentle, dismissible prompts; never personality labels.
- Cross-lesson evidence transfers only through approved subject/concept mappings. Mastery of one concept does not establish mastery of another.

Initial defaults: last five completed lessons or 90 days of relevant evidence, whichever is narrower. After three lessons containing meaningful assessment/help evidence, use observed behavior as default and signup preferences as a tie-breaker. These are tunable engineering defaults, not scientific claims.

Keep presentation preferences separate from knowledge estimates. Update individual memory immediately; shared model revisions require evaluated, versioned releases.

Teachers receive learning patterns, not raw questionnaires/private adaptation reasons. Suppress new questionnaire-derived aggregates below five learners. Explain that existing lesson-conversation oversight can still reveal interests voluntarily discussed.

External AI receives only relevant, explicitly disclosed teaching preferences and permitted confidence/study-support signals. Exclude identity, age, guardian details, comfort scores, exact schedules and device identifiers. Recheck permission before dispatch and before retaining optional returned results.

Withdrawal stops future optional processing and removes optional profiles/derived summaries. Offline copies clear when the device next participates; do not promise instantaneous remote deletion.

### 4. Local execution and staged delivery

Use existing TypeScript application/PostgreSQL infrastructure.

- Start adaptation with transparent rules/conservative knowledge estimates. Evaluate [pyBKT](https://github.com/CAHLR/pyBKT) later against the baseline using assessed response sequences.
- Use [pgvector](https://github.com/pgvector/pgvector) for server semantic retrieval when the approved corpus warrants it; retain authorization filters.
- Benchmark local generation through [llama.cpp](https://github.com/ggml-org/llama.cpp). Before choosing weights, record available RAM/GPU memory, license suitability, grounded-answer quality, latency and memory use.
- Keep local generation optional until evaluation passes. External generation remains consent-controlled and explicitly configured, with no silent fallback.
- Preserve existing offline matcher initially. Evaluate [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) embeddings separately; ship only after demonstrating better matching without unacceptable device/download costs.
- Defer neural knowledge tracing, pooled cross-school training, automatic retraining and high-throughput GPU serving. First release shares algorithms/content, not learner training data.

Deliver vertical milestones:

1. Consent-ready onboarding/private editable preferences.
2. Offline adaptation with reasons and individual cross-lesson memory.
3. Reusable question/explanation preparation and teacher review.
4. Local-model benchmark and provider-independent generation.
5. End-to-end evaluation across two lessons/two simulated learners.

Apply supported text size, prepared audio, playback speed and reduced-motion settings immediately. Save unsupported language, captions, reminder and exam preferences honestly without implying implementation. Speaking preference never grants microphone permission.

### 5. Acceptance and release checks

- Adult/minor signup, guardian review, token expiry/reuse, withdrawal, draft recovery, editing and existing-account migration.
- Verify structured private questionnaire/model fields are excluded from unauthorized teacher/admin views, other learners, progress exports and static caches. External provider context uses the consented preference allowlist. Supplied text/audio and generated paraphrases require separate semantic-privacy assessment; field exclusion is not a non-disclosure guarantee.
- Evidence deduplication, subject isolation, expiry, explicit-choice precedence and understandable recommendations.
- Anticipated answers remain grounded; reject near misses, invalidate stale support and queue unsupported offline questions.
- Two simulated learners receive different routes, adapt after assessments, and carry appropriate evidence into a second lesson.
- Downloaded playback/explanations/quizzes/matching/local adaptation make zero API calls, including shared-device switching.
- Provider outage, local-model unavailability and withdrawal during generation.
- Measure grounded correctness, no-match precision, assessment outcomes, package size, latency, preparation cost and external-provider calls. Simulated results prove functionality, not learning effectiveness.
- Run contracts/types, relevant unit tests, school browser tests and the full existing demo acceptance suite.
- Legal review must address consent, profiling, retention and provider disclosure under Nigeria's Data Protection Act/current GAID before real-child rollout. Proposed verification is not itself compliance certification.

Hosted deployment/provider restore stay deferred. Physical low-end Android performance requires separate verification.

## Full questionnaire and intended use

These preserve the user's detailed requirements behind the combined plan. A/B are upfront except the explicitly optional comfort question. C-F are optional/settings/progressive.

### A. About you

| Question | Answers | Intended use |
| --- | --- | --- |
| What should Coteacher call you? | Text | Address learner; no provider identity disclosure. |
| What class are you in? | JSS1, JSS2, JSS3, SS1, SS2, SS3, other | Vocabulary/scaffolding; school placement stays authoritative. |
| Are you under 18? | Yes/no | Consent routing; ask before remaining questionnaire. |
| Which subjects are you taking? | Multiple selections | Relevant library preferences; never grants enrollment/access. |
| Which language do you learn best in? | English, Pidgin, Yoruba, Hausa, Igbo, other | Supported explanation language; disclose unavailability. |
| How easy is reading English text for you? | Easy, OK, hard | Reading scaffolding and supported audio balance. |

### B. How you like to learn

| Question | Answers | Intended use |
| --- | --- | --- |
| When something is hard, what helps most? Pick up to two. | Picture/animation, try it myself, step by step, real-life example, hearing it explained | Initial approved support selection. |
| Short explanations or detailed ones? | Short, detailed, depends | Explanation length. |
| Do you prefer listening, reading, or both? | Listening, reading, both | Supported text/audio presentation. |
| When you don't understand something in class, what do you usually do? | Ask teacher, ask friend, stay quiet, look it up later, try on my own | Gentle encouragement; private response. |
| How comfortable are you asking questions in class? | Optional 1-5 | Gentle invitations; private, excluded from teacher/provider views. |
| With Coteacher, would you rather speak or type? | Speak, type | Input preference; no automatic microphone consent. |

### C. Interests (optional)

| Question | Answers | Intended use |
| --- | --- | --- |
| What do you enjoy? Pick up to three. | Football, music, games, drawing, cooking, fashion, films, coding, reading, languages, business, other | Relevant examples; no reasoning-style inference. |
| What would you like to do after school? | Choices or not sure | Real-world examples. |
| Favorite subject and the one you find hardest? | Two subject choices | Starting suggestions/support. |

### D. Confidence and study habits (optional)

| Question | Answers | Intended use |
| --- | --- | --- |
| How confident are you in each subject? | 1-5 per subject | Provisional scaffolding, distinct from assessed understanding. |
| What feedback helps when you get something wrong? | Encouragement, straight to point, hints before answer | Feedback tone. |
| How long can you study on a school day? | Under 15 min, 15-30, 30-60, over 60 | Session/chunk suggestions. |
| When do you usually study? | Morning, after school, evening, weekends | Save preference; reminders unavailable initially. |
| What is your study environment like? | Quiet/noisy | Supported audio/text advice. |
| Do you share your device? | Shared/own | Profile and privacy guidance. |
| What internet do you have at home? | Wi-Fi, limited data, none/school only | Download advice; no silent downloads. |

### E. Accessibility (optional settings)

Simple switches/settings: larger text, captions on audio, slower speaking speed, fewer animations. Ask what helps, not medical conditions. Apply implemented capabilities; distinguish prepared audio from uncaptained teacher recordings. Do not invent teacher captions/translations or rely on network speech for offline use.

### F. Goals (optional)

| Question | Answers | Intended use |
| --- | --- | --- |
| What are you preparing for? | Class tests, WAEC, NECO, JAMB, other | Save priorities; no claim of full exam-practice implementation. |
| What do you want most this term? | Catch up, understand better, improve a grade | Progress framing. |

Show purpose: “We ask this to choose examples and explanations that fit you.” Explain relevant choices, for example: “We used a football example because you said you like football,” with editing/disable controls. Do not infer a fixed learning style. Behavior should progressively outweigh signup answers, while explicit choices remain available.

## Repository findings and integration points

All findings below came from reads during planning/initial implementation exploration; verify exact current code before editing.

### Account/student journey

- `apps/shared/AccountGate.tsx`: current signup/login/MFA/recovery and guardian-assisted registration. Existing guardian checkbox/metadata is not verified relationship evidence.
- `apps/shared/account-api.ts`: `accountApi(path, data?)`, GET when no body and POST with JSON otherwise, under `/api/v1/`; errors use returned `error`. `AccountSnapshot` derives from `SchoolService.snapshot`. Config includes simulated/managed/tutor/live flags and role URLs.
- `apps/student/src/SchoolStudent.tsx`: school library, enrollment, downloads and PIN unlock. Complete local lessons open **outside AccountGate**, even when browser reports online. Preserve this network-free path.
- `StudentHome` inside that file currently loads lessons on account change and has Home/My Lessons/Subjects/Downloads/My school/Profile navigation. Suitable connected preferences entry point, but do not put onboarding requests on downloaded replay.
- `SchoolStudy` reuses `StudentPlayer` and `useConnectedTutor`, encrypted save queue, receipt sync and complete-media downloads. Keep one continuous player/tutor experience.
- `apps/student/src/storage.ts`: PIN-encrypted `Snapshot` includes lesson, progress, player, optional sync/tutor; validates ownership/contracts and local audio references. New private offline state requires validation, encryption, version/migration and ownership, not bare localStorage.

### Backend, privacy and persistence

- `delivery/school-store.ts`: `SchoolService`, `SchoolRepository.transaction`, local JSON repository, `emptySchoolState`, `restoreSchoolState`, `checkSchoolState`; snapshot projections expose selected account/membership data. Do not place questionnaire answers on account objects.
- `schemas/school-state.schema.json`: strict aggregate schema. Current consents have id/accountId/guardianEmail/kind/acceptedAt/withdrawn, kinds guardian/school-authorized/external-ai. No verified guardian lifecycle or private questionnaire records.
- `delivery/school-postgres.ts`: entire state is JSONB row id=1, locked `SELECT FOR UPDATE`, validated before commit, RLS enabled and browser roles revoked. Extend compatibly; avoid introducing a second database for this milestone.
- `delivery/server-encryption.ts`: existing AES-256-GCM `sealServer/openServer` with associated context and high-entropy server keys, separate from PIN transfers. Reuse with purpose/owner binding for private profiles.
- `delivery/private-storage.ts`: existing private object storage abstraction. If private profiles/evidence use new objects, register references in backups, maintenance and deletion.
- `delivery/school-http.ts`: `/api/v1` handler, origin/CSRF checks, JSON/body bounds/rate limits, managed/local auth, snapshot, MFA administrator enforcement. Integrate authenticated routes here; guardian-token verification needs its own narrowly scoped anonymous boundary before account auth, without weakening ordinary routes.
- `delivery/server.ts`: creates SchoolService, SchoolLessons, SchoolTutor and schoolHttp; tutor storage key comes from existing environment or fictional local default. Do not silently use development keys in public mode.
- `delivery/school-backup.ts`: snapshots validated state and copies lesson template/audio, learning-record and tutor-record objects. New private references must be included in backup/restore.
- `delivery/school-maintenance.ts`: referenced object set uses those same three groups; obsolete versions retire for 24h before deletion. Extend references before introducing new object records.
- `delivery/school-integrity.ts`: add integrity checks alongside strict schemas where owner/reference invariants are added.

### Learning/tutoring

- `packages/shared/src/personalized-replay.ts`: `ReplayInput` selects approved diagram/ordered annotations; current catalog is fixed, source-linked and refraction-specific. Keep teacher audio/timing/objective unchanged. Do not mislabel a new general preparation engine as implemented by this catalog alone.
- `packages/shared/src/tutor-memory.ts`: lesson-scoped observed memory, concept evidence, learner visual choices and incorrect checks; observations capped at 1,000. Cross-lesson state remains unimplemented.
- `delivery/tutor-store.ts`: received progress, sourced answer/check validation, recent same-concept history (four turns), recent observations (ten), provider worker and persistence. Teacher oversight reads stored TutorState; raw profile/private explanations must never enter it.
- `delivery/tutor-provider.ts`: `TutorProvider` answer/speak/transcribe/optional check; `TutorInput` includes question/objective/concept/classLevel/sources/visuals/history/observations. OpenAI implementation is current; adding local text generation must honestly handle speech/transcription availability and existing engine enums.
- `delivery/school-tutor.ts`: identity-authorized wrapper, existing provider/consent checks, school-scoped encrypted persistence and worker reuse. Add profile access via a sanitized decision/projection, not a raw profile injected into teacher-readable memory.
- Matcher is deliberately conservative, deterministic prepared matching. Keep threshold, unknown-term guard and no-match semantics during first iteration.

### Contracts/tests

- `scripts/generate-types.mjs` enumerates schemas explicitly. New schemas must be registered there and in validators/shared exports as appropriate.
- `tests/school-fixture.ts`: simulated owner/teacher/student/outsider plus active school/group/offerings and synthetic Opus recording helper. Reuse this for permission/isolation tests.
- Existing relevant suites: school-registration, school-http, school-lessons, school-tutor, school-backup, school-maintenance, profile-storage, personalized-replay, and browser school journeys.

## Next implementation sequence

1. Record this extension in scope/architecture/data docs and establish milestone acceptance cases. Preserve the old sprint history as historical rather than claiming cross-lesson memory exists already.
2. Add schema-first private onboarding/consent/evidence contracts, generated types and validation; plan migration/default restoration for existing accounts. Separate student-only DTOs from reviewer consent DTOs.
3. Implement encrypted repository/private-object persistence, authenticated profile endpoints, guardian token/review lifecycle and consent enforcement. Existing registrations/downloads remain compatible. Sending actual email needs an explicitly authorized delivery route; the user's feature request authorizes implementing delivery, not unsolicited messages to real people during testing.
4. Implement four-screen progressive onboarding and My learning preferences, class/subject prefills, school change requests, supported accessibility, purpose/availability notices and withdrawal. Verify real browser desktop/mobile interaction.
5. Integrate private local evidence into offline player decisions and encrypted storage; sync relevant cross-lesson evidence safely. Ensure deterministic deduplication and no network on local replay. Build two simulated lesson fixtures with approved concept mappings.
6. Build preparation/review/publication with revision invalidation and bounded reusable content; preserve genuine source safety checks, not only schema acceptance. Unknown questions stay queued.
7. Add replaceable generation with no silent provider fallback. Inspect hardware safely, benchmark an appropriately licensed local model if feasible, and record actual vs mocked results. Do not claim llama.cpp or local weights are installed/verified before inspecting.
8. Complete below tests, evidence and updated handover. Report any genuinely external gates as unverified; do not mark the whole feature complete just because individual components render.

## Validation commands and evidence expectations

Use checks appropriate to each vertical task, then final regression:

```powershell
npm.cmd run generate:types
npm.cmd run check:types
npm.cmd run typecheck
npm.cmd test
npm.cmd run pipeline -- --lesson fixtures/demo-lesson
npm.cmd run build
npm.cmd run test:e2e:school
```

Original demo suite uses `build:demo`/`test:e2e`. Prior work used `COTEACHER_E2E_BUILD_ROOT=.task-tmp/e2e-demo` to avoid replacing normal PC builds; inspect `tests/e2e/README.md` and harness/config before running. Run expensive checks sequentially on this memory-constrained host. Clear task-specific environment variables afterwards in that process.

Prior school checkpoint recorded 37 unit files/492 tests, generated types/typecheck, all three builds, three school browser tests and a complete 45-pass demo browser run (13.4 minutes). Those results predate onboarding; **none are new-feature verification**. Synthetic microphone/mocked tutor tests prove their pipeline only; real provider results are documented separately.

Record desktop and narrow-screen browser behavior, offline reopen with zero API calls, independent shared profiles, teacher access denials and explicit provider payload checks. A working local text model does not verify offline voice. Simulated learners do not demonstrate real educational benefit.

## Legal research status and external references

Current legal review was requested by the user. Planning consulted official NDPC search material, but direct downloads of the Act/GAID PDFs returned HTTP 403. No complete legal review or compliance conclusion was established. Keep legal/operational signoff as a real-child release gate, not a blocker for fictional local implementation.

- [NDPC Act landing page](https://ndpc.gov.ng/download/nigeria-data-protection-act-2023)
- [Official Act PDF, inaccessible during planning](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf)
- [Official GAID PDF, inaccessible during planning](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf)
- [Official 2025 annual report](https://ndpc.gov.ng/wp-content/uploads/2026/02/Print_NDPC-Annual-Report-2025-1.pdf), search material records GAID issuance/effect dates.

Do not simplify legal rules into “email plus staff review always suffices”; appropriateness depends on the approved lawful basis, verification and deployment circumstances. No ID-document collection by default.

Open-source options were researched as components, not installed dependencies or completed evaluations: pyBKT, pgvector, llama.cpp, Transformers.js; later [pyKT](https://github.com/pykt-team/pykt-toolkit) for neural knowledge-tracing benchmarks and [vLLM](https://github.com/vllm-project/vllm) for justified server throughput. Recheck selected versions/model licenses at actual integration time. Local hardware/electricity/maintenance costs matter; no cost reduction percentage has been proven.

## Continuing from the implemented checkpoint

Read the latest checkpoint and `student-learning-acceptance.md` before using the
historical inspection/sequence above. The implementation now exists; do not start
schemas/onboarding again or repeat the local-model download/benchmark. The application regression does not establish completion of the student-model
foundation. Stop after each approved batch for user review; do not start the
evaluation harness, speech evaluation, broader interface refactor or local-model
work without further approval.
Preserve the running account previews and private provider configuration. Hosted deployment, provider-target restore, real-child rollout and
physical-device verification remain separate, deferred gates.
