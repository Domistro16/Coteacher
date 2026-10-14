# GPT-Live student avatar verification — 2026-10-13

Implemented the voice/backend split described by the official OpenAI documentation:
[GPT-Live](https://developers.openai.com/api/docs/guides/live),
[client delegation](https://developers.openai.com/api/docs/guides/live-delegation),
[browser WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live).
No Agents SDK, new backend service, classroom transcription or student redesign.

## What changed

- `delivery/live-provider.ts`: server-only GPT-Live session creation, client
  delegation, fixed conversational/source boundaries, explicit `store:false` and
  AI voice. The reasoning agent remains the existing `OpenAITutor`/TutorStore.
- `delivery/server.ts`, `tutor-store.ts`: PIN/context/consent-checked session route,
  bounded session requests, durable deduplicated logs and early publication of
  checked text while its separate offline MP3 is prepared. Voice reads no longer
  hold or compete for the progress-write lock during provider calls.
- `schemas/live-session.schema.json`, `schemas/tutor-state.schema.json`, generated
  types, shared exports/validator and type-generation script: bounded connection
  requests and optional exact-concept voice transcripts with identifiable source
  context. Existing saved snapshots remain compatible.
- `apps/student/src/live-voice.ts`, `useLiveVoice.ts`, `useConnectedTutor.tsx`:
  native WebRTC, transcript accumulation, stable delegation IDs, guarded async
  callbacks, encrypted connection exchange and transcript sync without dropping
  newer local work. Microphone stops on exit, lock, blur, hiding and disconnection.
- `StudentPlayer.tsx`, `CompanionVoice.tsx`: live conversation inside the existing
  frozen-moment help panel, the original avatar, sourced visual overlays,
  follow-ups, concept checks and return to the teacher recording. Captions/text
  remain available. New voice questions mute live output until an approved
  prepared/procedural or checked backend result is supplied. Mouth motion uses
  decoded receiver energy and the native live playhead, not the teacher clock.
- `apps/teacher/src/TutorOversight.tsx`: collapsed device-reported voice log;
  it distinguishes supplied source context from unverified or suppressed speech.
- Env startup/probe loaders now accept root `.env` as well as `.env.local`.
  `.gitignore` protects both; `.env.example` adds an independent live model option.
- `delivery/verify-live-avatar.ts`, package verification command, unit/browser
  tests, acceptance/docs/PROMPTS updates provide repeatable verification.

## Real API evidence

The configured project returned HTTP 200 for `gpt-live-1` model access. A separate
real Responses/TTS probe returned a newly generated sourced answer and a 691,968
byte MP3. This was actual OpenAI traffic, not the mock provider.

The final `npm run verify:avatar:live` probe returned **PASS**:

- Voice model `gpt-live-1`; independent reasoning model `gpt-4.1-mini`.
- Native WebRTC session started and recognized simulated spoken microphone input.
- GPT-Live emitted client delegation; actual Responses reasoning supplied a
  checked answer citing approved refraction notes and the curated NASA lens text.
- Generated voice arrived over native audio: 67,974 inbound bytes, 677 packets,
  689,280 received samples, total decoded audio energy 0.20262349 and live playhead
  13.8 seconds. It began speaking the returned explanation.
- `session.closed` was received, confirming graceful completion.
- The read-only probe changed no school progress, questions or publication.
  Evidence artifact: `.task-tmp/live-avatar-proof.json` (ignored).

This tests real model/transport/speech delivery, not a physical microphone or the
entire live student follow-up conversation. Input is a WAV generated locally for
the fictional test learner; the **avatar output is real OpenAI speech**. Earlier
probes timed out at an inappropriate analyser check despite positive native
receiver energy, or at delegation. The final check uses native receiver statistics.
Transcripts and receiver energy do not establish that a person heard the speaker.

## Automated verification

- `npm test`: **425 tests in 24 files passed**, including generated contracts and
  TypeScript. New tests cover owner/consent/configuration rejection, immutable
  deduplicated logs and restart isolation, missing transcript handling, duplicate
  delegation IDs, cancellation/late microphone permission, output gating and
  checked text before slow speech without overwriting teacher flags.
- Both production builds pass. Existing teacher chunk warning remains (~526 KB
  minified, ~158 KB gzip); no lint script is configured.
- Demo lesson pipeline validates the approved simulated fixture.
- The complete tutor browser journey passed independently: native teacher capture,
  timeline review/approval/publication, simulated live transport, prepared answer,
  saved logs, connected mock follow-up and quiz, evidence-based A/B suggestions,
  download, offline prepared/no-match questions, reopening and reconnect return.
  It checks 360px/desktop layout and the exact preserved recording position.
- Broad regression: **43 passed; the tutor scenario timed out at its first teacher
  navigation action**. The recorded run reported 59 minutes, including a 30.8-minute
  timeout despite the configured five-minute test limit. Do not report this as a
  clean 44-test run or assert a proven cause. The earlier independent tutor run
  passed; the final updated tutor scenario also **passed in a separate rerun
  (1.1 minutes)**. All 44 scenarios are verified across these runs; this is not a
  single clean 44-test run.
- Existing passing scenarios cover narrow screens, safe activity checks, encrypted
  profiles, real native media/cues, recording pauses, offline A/B packages,
  synchronized animations/projector/review, quiz retries, receipt-backed progress,
  returned answers and teacher insights.

One browser test initially injected simulated transcript events while connection
setup was still underway; it now waits for the actual started/listening state.
Another uncovered a real 409 race between background saving and question
transcription. Read-only voice routes now operate without the progress-write lock.
Tests disclose their mock voice/model transport; they are not live API evidence.

## Voice entry routing fix — 2026-10-13

The generic Enable voice mode control previously selected local-only recognition,
which explains the unsupported offline recognizer message on connected devices.
The player and prepared avatar now offer **Talk with Coteacher** while connected,
opening the existing exact-moment paused panel and consent disclosure. Explicit
local controls say **Enable offline voice mode** or **Hold to talk offline**.
Live start waits for a validated server acknowledgment of enabled tutoring and
lesson context. Retry also refreshes the existing school connection hint.

- Both app builds and the final TypeScript check pass; the existing teacher chunk
  size warning remains. No lint script is configured.
- Focused speech, companion and live transport unit tests: **17 passed**.
- Final `COTEACHER_TEST_TUTOR=mock` tutor browser journey: **1 passed (2.4 minutes)**.
  With SpeechRecognition deliberately absent, the primary action opens live setup,
  preserves refraction and the exact paused clock, captures no microphone before
  consent, and captures once after explicitly starting. It then verifies prepared
  delegation, contextual follow-ups, quiz/memory, audio download, unsupported
  offline recognition with successful text help, queued questions, offline restart,
  reconnection and independent A/B recommendations. Model/voice transport is mocked;
  Chromium microphone input is simulated. The native recording/media path runs.
- A broader five-scenario recording/tutor run was interrupted after its first
  recording scenario ran for several minutes without returning a result. It
  supplies no new pass/fail evidence; the prior regression results above remain
  separate. Its delay has not been diagnosed.
- Dev student, teacher and delivery endpoints return HTTP 200. Delivery reports
  OpenAI configuration. No new live API probe was run for this frontend fix;
  the earlier real API evidence above is unchanged. A physical device microphone
  conversation remains a manual check.

Files: StudentPlayer, CompanionVoice, useConnectedTutor, App, contextual voice
browser helpers/tests, and the connected tutor/acceptance/verification documents.
Recording, sources, timeline identifiers and persistent learner data were not
rewritten.

## Remaining limits

1. **Manual verification:** complete real student microphone → explanation → spoken
   follow-up → check → resume on the intended Android/browser/speakers. Live API
   speech delivery is proven separately; full UI conversation tests use mocks.
2. **Source/safety quality:** citation excerpts and approved visual IDs are checked;
   factual accuracy, live paraphrases and transcript completeness are not guaranteed.
   Muting blocks unchecked new teaching output; logs may include suppressed text.
   Teacher oversight remains necessary. This prototype permits fictional profiles
   only; it is not ready for identifiable children's data.
3. **Offline:** live recognition/reasoning/speech require connectivity. Prepared
   explanations, activities, quizzes and teacher recordings still work offline.
   Retrieved Responses MP3s are cached privately; the live voice stream is not saved.
4. **Memory:** evidence-backed rules and recent observations persist separately per
   learner. Predetermined A/B package routes remain labelled simulated. No model
   retraining, permanent learning-style labels or automatic cross-lesson packages.
5. **Deployment:** public demo PINs/local teacher access, browser storage eviction,
   provider retention/consent, paid session limits, persistent session cleanup,
   multi-device conflicts and manual transfer of the new AI sidecar remain limited.
   Cloud media hosting/authentication is still unconfigured.
