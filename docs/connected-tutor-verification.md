# Connected tutor and learner memory verification — 2026-10-12

**2026-10-13 follow-up:** the server key is now configured. Real OpenAI Responses
and MP3 speech succeeded; the separate GPT-Live/client-delegation/native speech
probe also passed. The historical missing-key results below apply to the earlier
mocked run. See [current voice verification](live-avatar-verification.md) for actual
API evidence, new integration, regression results and remaining manual checks.

Verdict: the lightweight integration and mocked student journey work. A genuine
OpenAI student demonstration is **not yet verified**: no server key was configured,
and the user explicitly requested mocked verification for now. Production startup
does not substitute mock responses when a key is missing.

## Seven requested behaviours

| Requirement | Result | Evidence |
| --- | --- | --- |
| New connected question → generated, sourced, spoken AI answer | PARTIAL | Real Responses/TTS integration implemented. Mock-provider browser test receives cited text and plays returned MP3 through native audio. Genuine OpenAI answer/speech UNVERIFIED. |
| Contextual follow-up, understanding invitation and short quiz | PASS for control flow; model quality UNVERIFIED | Same-concept conversation history checked in units; avatar speaks, accepts follow-up, offers the approved quiz and saves the attempt in the browser. |
| Learning events update persistent memory | PASS | Stable received event IDs produce stored observations and inspectable evidence links. Seeded learner histories are excluded. |
| Different recommendations for A and B | PASS | A's incorrect refraction check suggests `refraction-pencil`; B's explicit choice suggests `refraction-steps`. These are evidence-backed rules, not a trained recommender. |
| Memory survives restart | PASS | Fresh TutorStore instances recover encrypted files, including a queued job. Offline PWA reload restores the learner's memory and playback position. |
| Offline question saved → reconnect → response | PASS with mock provider | Prepared answer immediate offline; unmatched text/context survives reload, then receives a returned answer after real local-service acknowledgement. |
| Real API calls separately verified | UNVERIFIED | `npm run verify:tutor:live` reports missing key and makes no API request. HTTP payloads are tested only with an injected mock transport. |

## Tests run

- `npm test`: **420 tests in 23 files passed**, including generated contract checks
  and TypeScript. Six tutor tests cover durable jobs, withdrawn consent, follow-ups,
  idempotence, encrypted restart persistence, profile isolation, different observed
  recommendations, outages, citation rejection, hazardous questions, teacher flags
  and real-provider request construction with a mocked transport.
- `npm run build`: both apps passed. Student build repeated after the last caption
  disclosure change. Existing teacher chunk warning remains (~524 KB minified,
  ~158 KB gzip); no lint command is configured.
- `npm run pipeline -- --lesson fixtures/demo-lesson`: approved simulated fixture
  valid.
- Explicit mock-provider tutor browser journey: passed independently, then passed
  again during the full regression run. It starts with actual native microphone
  recording, captures a visual transition, reviews audio, approves both visual
  variants and publishes through the real local distribution service. Student
  voice capture uses native MediaRecorder with simulated microphone input; only
  transcription and model responses are mocked. Returned clips are actual audible
  prepared MP3s, not evidence of genuine AI speech synthesis.
- Full Playwright regression: **43 passed, one timing assertion failed**. The test
  read the running audio clock immediately before interruption; the paused clock
  differed by 1 ms. The test now reads after interruption and retains exact equality
  against the captured stopped clock. The affected complete native recording test
  then **passed in a targeted rerun**. All **44 scenarios** are verified across
  these runs; this was not a single clean 44-test run.
- Existing coverage includes 320/360/768/1440px layouts, keyboard accessibility,
  five-second animation/projector synchronization, reduced motion, actual media
  beyond two minutes, codec stop boundaries, microphone denial/cancellation,
  storage failure, real lesson publication, two personalized visual sequences,
  native audio/seek/resume, offline reopening, activity/check feedback, shared-device
  isolation, school receipts, returned guidance and teacher concept insights.
- New tutor coverage includes a 360px and desktop contextual panel, bounded native
  voice capture, transcript review, text questions, audible returned Blob audio,
  frozen teacher position, follow-up, quiz, evidence-based suggestions, offline
  prepared/no-match paths, restart, reconnect resolution and A/B record separation.

The Chrome microphone device and local recognition results are simulated. Native
capture/encoding, actual stored audio, visual cues, playback clocks, MP3 playback,
encrypted IndexedDB, service-worker offline reopening and the local HTTP receiver
are real application paths. Physical microphones, projectors and low-end Android
hardware still require manual testing.

## Files and integrations

- Contract: `schemas/tutor-state.schema.json`, generated TutorState types, shared
  `tutor-memory.ts`, exports and type-generation script. Answers have `sourceRefs`
  bound to identifiable stored citations; state validates owner, original question,
  concept, step, recording timestamp, approved visual and evidence IDs.
- Backend: `delivery/tutor-provider.ts`, `tutor-store.ts`, `verify-live-tutor.ts`;
  updates to `server.ts`, `start.ts` and `progress-store.ts`. Reuses publication,
  received-record validation, encrypted transfer, atomic files and existing receipts.
  Published lesson metadata is cached without weakening validation; internal
  validated reads avoid needless encrypt/decrypt round trips.
- Student: `useConnectedTutor.tsx`, `useConnectedVoice.ts`, `TutorSources.tsx`;
  integrates App, StudentPlayer, StudentShell, storage, PlayerQuestions,
  CompanionVoice, useCompanionSpeech and useProgressSync. Both sync paths use the
  authoritative current snapshot when merging delayed results. Teacher-returned
  guidance takes precedence over an older AI reply.
- Teacher: `TutorOversight.tsx` integrated into TeacherQuestions and TeacherInsights;
  teacher proxy authorization extended in `apps/delivery-proxy.ts`.
- Tests: `tests/tutor.test.ts`, `tutor-fixture.ts`, `tests/e2e/tutor.spec.ts`, explicit
  provider injection in e2e servers and corrected pause-clock capture in
  `companion-conversation.ts`.
- Setup/docs: `.env.example`, package verification script, PROMPTS.md, scope/safety
  updates, connected-tutor acceptance, implementation and verification documents.

The existing student/teacher design, recorder, projector, approved visual catalogue,
timeline, personalized package format, shared encrypted teacher media, activity/quiz
logic and manual school transfer remain in use. No new backend service, cloud
storage, MP4 renderer, transcription-based presentation control or lesson-authoring
AI was introduced.

## Remaining limits

1. **Live-demo blocker:** configure server-only `OPENAI_API_KEY` and perform genuine
   answer, speech, follow-up and microphone transcription tests. The separate live
   probe is read-only against school progress; it saves its MP3 in `.task-tmp`.
2. **Real-child deployment blocker:** public fictional PINs and loopback teacher
   proxy access are demo boundaries, not production identity/security. Connected
   tutoring sends questions, excerpts and recent context to OpenAI; connected voice
   sends audio. `store:false` does not mean zero retention. Identity/access control,
   appropriate consent/provider policy, deletion and retention are needed before
   real children's data is used.
3. **Content-quality limitation:** exact citations and approved visual IDs are
   checked, but model confidence is self-reported and source checks cannot guarantee
   factual correctness, complete safety or visual/word alignment. Teacher oversight
   and live answer review remain necessary. Context uses approved concept excerpts
   and the captured timestamp; the teacher recording itself is not transcribed.
   Curated fallback currently covers one
   small NASA lens excerpt; unsupported topics should defer.
4. **Adaptation scope:** memory is limited to the active recording. Recommendations
   are observed-event rules; existing packaged A/B visual sequences remain explicitly
   predetermined. Automatic future-package regeneration, cross-lesson transfer and
   trained recommendation models are deferred.
5. **Offline/transfer limitation:** retrieved AI replies keep their AI/mock origin;
   they do not become approved prepared content. Teacher flags arrive only with a
   connection. Manual progress exports preserve the existing questions/events and
   reviewed returns, but do not export the new AI reply/memory sidecar. The dedicated
   inbox shows resolved AI responses separately; legacy canonical progress summaries
   may continue counting the original unanswered teacher-return queue.
6. **Storage/runtime limitation:** one local service process owns the storage folder;
   worker concurrency is at most one per learner. Replies/clips are bounded, but
   there is no pruning UI or multi-device conflict merge. Browser eviction/quota,
   Android performance, secure-context microphone requirements and browser-specific
   recognition/recording support need real-device verification. Cloud deployment
   and media distribution remain unconfigured.

Development endpoints checked: teacher `http://127.0.0.1:5174`, student
`http://127.0.0.1:5175` both HTTP 200. Updated local backend on port 8787 responds to
tutor oversight and honestly reports provider `unavailable` without a key.
