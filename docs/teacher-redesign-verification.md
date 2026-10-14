# Teacher workspace and school return verification

Implemented and checked on 2026-10-09. This is a connected product workspace for
the existing one-lesson sprint, with genuine recording, local publication and
acknowledged progress return. It is not a general authoring system or a deployed
school service.

## Screens and visual system

The teacher app directly imports the student Nunito typography, design tokens,
brand, icons, learning artwork, buttons and recorded player. Teacher-specific
styles arrange a wider, quieter professional workspace. The student design is
preserved. Desktop uses a sidebar; tablet/mobile use compact scrollable navigation.
Keyboard skip navigation, visible focus, semantic labels, disabled actions,
feedback, reduced motion and 320–1440px layouts are checked.

| Screen / hash | Working experience |
| --- | --- |
| Dashboard / `#/dashboard` | Welcome, four preparation/recording/insight actions, real preparation/recording/publication lesson state, received-question count and labelled seeded insight preview |
| My Lessons / `#/lessons` | One actual saved demo preparation; draft/review/recording/publication status and relevant continuation actions |
| Prepare lesson / `#/prepare` | Details → teaching materials → one-concept-at-a-time preparation/review → approved and ready to record |
| Teach / projector / `#/teach` | Approved presentation, manual stable-ID cues, native microphone permission/capture/pause/resume/stop, clock, microphone feedback and projector view |
| Recording review / `#/review` | One native audio player, seeking and chapters, Default/A/B visual preview selector, audio and visual approvals, save/recovery/delete |
| Publish packages / `#/publish` | Actual recording/timeline/review readiness, complete package publication and genuine local service acknowledgement |
| Class insights / `#/insights` | Received snapshot count, labelled seeded cohort, selectable concept heatmap, contributing events, descriptive explanation counts and exact-concept teaching action |
| Questions / `#/questions` | Exact concept, learner, submission time, pending/answered filters, open concept and prepared-answer review action |
| Sync & Transfers / `#/transfers` | Direct service status/check, encrypted package exports, validated progress imports, received record review, prepared answer return and file fallback |
| Settings / `#/settings` | Honest local-workspace, simulated-profile, account/security and unavailable-service information |

Teacher authentication is absent from the existing stack. The greeting says
“Welcome back, teacher”; no invented authenticated name or login is displayed.

## Existing functionality reused

- `preparation.ts`, the reviewed-material generator, approval helpers and contract
  validation retain persistent sources/drafts/approval and reject draft exports.
- `Presentation.tsx` retains stable lesson/concept/step IDs, forward/backward visits,
  persistent position and projector mode. Approved instructional content is not
  changed during presentation.
- Native capture retains AudioWorklet/WebCodecs Opus encoding, sample-clock cues,
  muted pause exclusion, navigation protection and durable audio/timeline saving.
  Permission errors and unsupported capture do not produce a fake recording.
- `RecordedLesson` retains actual audio playback, synchronized SVG scenes, seeking,
  chapters, speed and fullscreen. Switching teacher learner previews preserves
  the audio element, source and current time. It never speaks substituted TTS.
- Original audio review and all prepared visual review remain separate gates;
  publication/export independently validate these gates. Unsaved media keeps
  replay/retry available and blocks navigation until successfully saved.
- Existing loopback publication/range streaming, encrypted manifests, verified
  complete downloads, shared encrypted media, PIN profiles, local learner progress,
  contextual help, safe activity, checks and manual school transfers remain intact.

## Preparation and publication truth

The details step selects the existing Science / Light and refraction / simulated
JSS 2 lesson and its fixed shared objective. There is no arbitrary metadata editor.
Sources accept `.md`/`.txt` below 50 KB; deterministic preparation accepts only the
two supplied reviewed materials. File cards reflect actual successful loading;
unsupported files produce errors. Draft sources and review state survive reload.
Source changes/regeneration revoke approval. Review includes original/alternative
explanations, the actual SVG aid, safe activity, checks, answers and source refs.
Factual checking still belongs to the teacher; source validation is structural.

Publication uses the existing real `POST /api/lessons` route. The UI only reports
publication after a matching recording ID, positive byte count and both expected
learner IDs are acknowledged by the service. Missing/unreviewed media disables
publication. Dashboard publication status is tied to the current saved revision.
The receipt and both packages are real; “Published to Cloud” is never shown.

Default/A/B scenes use existing prepared source-grounded assets. Two simulated
histories deterministically choose concrete diagrams versus ordered annotations,
with the same original audio, cue chronology and objective. The review selector
and inspectable decisions explicitly describe this simulation; they do not label
permanent learning types or claim a trained recommendation model.

## Automatic school return and manual transfer

The smallest integration extends the existing loopback delivery service. It does
not create another backend or require a network response to watch, ask prepared
questions, practise, or save locally.

1. A collected recording and encrypted learner snapshot must be saved successfully.
   While connected and unlocked, a 1.8-second quiet period triggers optional return.
   Connected retries are bounded to 30 seconds; Profile offers an explicit retry.
2. `POST /api/progress/{studentId}/{recordingId}` receives a PIN-encrypted snapshot.
   The service decrypts against the published profile, validates sources and exact
   lesson/recording ownership, rejects divergent or shorter event history and
   fabricated answered questions, preserves reviewed answers and writes atomically.
3. Only after durable saving does it issue the closed `progress-receipt` contract:
   learner ID, lesson ID, recording ID, submitted SHA-256, acceptance timestamp and
   `simulated: true`. The client validates the receipt and digest before showing
   “school received your progress”. HTTP success alone is insufficient.
4. `GET` on that learner/recording route returns encrypted prepared answers. Merge
   uses the latest active learner snapshot; lock/profile switching cancels pending
   work. Events, current playback position and other learners are preserved.
5. Teacher `GET /api/progress` requires the teacher proxy token and returns validated
   snapshots for the currently published recording. Relevant teacher screens check
   every 15 seconds; Sync & Transfers also has a connection-check action. File and
   school ingestion are serialized; received snapshots persist encrypted locally
   and restore only after owner/lesson validation.
6. The explicit local answer simulation prepares the one supported sourced plastic
   cup answer. Teacher `POST /api/progress/answers/{studentId}` validates and saves
   it before confirming return. Unsupported questions remain pending.

There is no destructive “clear queue on success” operation. Failed requests,
invalid receipts and unavailable services preserve all local learning records and
questions. Student API proxies cannot access teacher progress or answer routes.

An offline event persists a device hint because Chromium offline emulation reports
`navigator.onLine` as true after cached PWA navigation. Offline reopening suppresses
background return/catalogue requests until a connection event or explicit retry;
that retry still needs a real service acknowledgement. If an app was closed during
reconnection and no online event arrives, use Profile → Try school sync.

Manual transfer remains functional: teacher Sync & Transfers exports encrypted
personal packages, validates PIN-protected learner progress, displays acceptance
or errors, prepares the supported answer and exports an encrypted returned file.
Student Profile owns import/export and lesson transfer. No raw transfer form was
added back to the player or home dashboard.

## Files and components changed for this extension

| Area | Files |
| --- | --- |
| Teacher structure/design | `apps/teacher/src/TeacherShell.tsx`, `App.tsx`, `SourceUpload.tsx`, `TeacherQuestions.tsx`, `teacher-theme.css`, `styles.css`, `apps/teacher/index.html`, `apps/teacher/public/fonts/*` |
| Existing studio/review | `apps/teacher/src/Presentation.tsx`, `RecordingPanel.tsx`, `apps/student/src/RecordedLesson.tsx` |
| Persistent teacher records | `apps/teacher/src/progress-storage.ts` |
| Student background status/return | `apps/student/src/useProgressSync.ts`, `App.tsx`, `StudentShell.tsx`, `student-theme.css` |
| Contract first | `schemas/progress-receipt.schema.json`, `scripts/generate-types.mjs`, `packages/shared/src/generated/progress-receipt.ts`, `progress-sync.ts`, `index.ts` |
| Existing backend/proxies | `delivery/progress-store.ts`, `server.ts`, `store.ts`, `apps/delivery-proxy.ts` |
| Tests | `tests/teacher-progress-storage.test.ts`, `delivery.test.ts`, `tests/e2e/teacher-design.spec.ts`, `teacher-navigation.ts`, `teacher-preparation.spec.ts`, `presentation.spec.ts`, `recording.spec.ts`, `delivered-replay.ts`, `distribution.spec.ts`, `full-demo.spec.ts`, `profiles.spec.ts` |
| Documentation | This report, teacher acceptance, teacher README, repository README, architecture/contracts/demo/safety/sprint docs, browser README and `PROMPTS.md` |

Shared brand/student player files already added during the preceding student task
are reused rather than replaced. Existing uncommitted changes and the separate
technical audit are preserved.

## Verification

- `npm.cmd test`: **367 tests across 17 files passed**; includes generated-type
  freshness and TypeScript checks. New tests cover encrypted teacher restoration,
  durable acknowledgements, isolated ownership, idempotent retries, rejected stale
  history, fabricated answers, preserved teacher replies, restart and save failure.
- `npm.cmd run build`: both production bundles pass. Teacher native review is
  lazy-loaded; shared assets/fonts are local. No remote runtime font is needed.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: valid sourced simulated
  demo package.
- Focused native browser journey passed: actual simulated microphone capture →
  manual sample-clock cues/pause/resume → saved synchronized review → Default/A/B
  preview on the unchanged audio → approval → actual HTTP publication → A/B stream
  and complete download → offline help/activity/checks → restart and independent
  resume → invalid receipt rejection → real school receipts → teacher insights and
  exact-concept questions → reviewed prepared answer return → teacher restoration.
- `npm.cmd run test:e2e -- --reporter=line`: **all 36 scenarios passed** in the
  final complete regression (7.9 minutes). This includes both redesigned apps,
  manual transfer, profile isolation, native recording, actual publication and
  school return, offline restart, question filters, exact-concept reopening and
  answered-question inspection. No retries masked failures.
- After final mobile CSS polish, both production bundles were rebuilt and a
  separate production-browser check at 320px recorded actual simulated microphone
  input, advanced concepts, saved/reviewed audio, verified unclipped controls and
  unwrapped chapter numbers, entered fullscreen, played advancing audio and exited
  fullscreen. No page errors or horizontal overflow occurred.
- The development apps were opened at 5174/5175 and the production student at
  4173. Real screen screenshots were visually inspected; the responsive checks
  cover 320, 360, 768 and 1440 pixels, keyboard navigation and reduced motion.
  Default service has no invented recorded publication: record and publish a
  teacher lesson to populate the student catalogue.
- There is no configured lint command. Type/contracts, build, unit/browser tests
  and whitespace checks are the available checks.
- `git diff --check` passed after final documentation/prompt logging.
- One concurrent TypeScript run exhausted the configured lifecycle heap; the
  sequential rerun passed. An older isolation assertion assumed empty localStorage;
  it now explicitly permits only the non-sensitive offline flag, with learner
  records/PINs still encrypted. Neither failure was hidden or treated as success.

## Remaining limitations

- Teacher authentication/name, arbitrary lesson editing, general AI generation,
  PDF/textbook parsing, learner/class assignment and a general teacher answer editor
  are absent. The guided workflow exposes the supported fixed lesson accurately.
- Class insights now keep the 18 labelled seeded learners separate from received
  interactions from simulated A/B accounts. Support indicators include requests,
  incorrect checks, retries and questions needing follow-up; pauses alone are
  context. Suggestions reopen exact approved materials for the selected concept.
  See [concept insights verification](teacher-insights-verification.md). There are
  no attention, causal effectiveness or mastery claims.
- Exact local learner playback positions are private device state; they are not
  inferred as teacher “completed lesson” totals from the event contract.
- The service binds to loopback. Public cloud/media delivery, cross-device school
  deployment, HTTPS, production identity/authorization and retention still need
  configuration. Teacher media on server disk is plaintext; public demo PINs and
  the demo proxy token are not production security.
- One current publication, two simulated profiles and one active learner tab are
  supported. Conflicting device histories are rejected for manual reconciliation,
  not merged speculatively. New recording revisions require fresh matching return.
- Capture requires secure-context Chrome/Edge-compatible AudioWorklet and WebCodecs
  Opus. Actual human microphone quality, physical Android performance/installation,
  Safari and Firefox are not verified by Chromium automation. Tests use a non-silent
  simulated microphone signal; no real classroom or child audio is recorded.
- Teacher/browser storage can be evicted. Stopped audio is persistent; an unfinished
  recording cannot survive a crash. Source-only exports remain a clearly labelled
  secondary transfer option and do not masquerade as recorded lessons.
- No speech-following, transcription or teacher-voice replacement is added.
