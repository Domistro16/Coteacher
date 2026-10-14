# Safety, privacy and data rules

## Content
- Every explanation, question-bank answer, quiz item and Try it activity has `sourceRefs` pointing to entries in `sources`.
- The sprint assembles supplied, manually prepared instructional content. Source-ID
  and contract checks verify structure, not factual accuracy. Teachers review facts
  and activity safety before approval. Collection/publication also compare the
  fixed demo instruction and narration paths against the reviewed bundle, so edited
  activities, explanations, quizzes or citations cannot reuse an approval marker.
- Cite textbooks by reference and page. Do not reproduce long passages.

## Try it activities
- Safe, common household items only. No heat, chemicals, sharp tools, or anything a child could be hurt by.
- Each activity has `items`, `steps`, `explainsWhy`, `safetyNotes`, and `returnToStep`.
- Offer Try it only where a simple safe activity exists.
- Completion is a learner self-report. It opens the approved check for the exact
  activity concept; it does not count as demonstrated understanding. Preserve
  each selected answer/retry and its sources, show current feedback separately
  from completion, and do not infer long-term learning from a correct response.

## Personalization
- Same learning objective, teacher audio and concept chronology for every student;
  the route and teacher-reviewed supporting visual choices may differ.
- Show the student why something was added and let them skip it or switch to the teacher's original.
- Never label a student as a learner "type."

## Data
- No real children's data in fixtures, tests, or demos. Use fake names and pseudonymous ids.
- Seeded data carries `"simulated": true` and is visibly marked in the UI.
- Personal packages and progress files are protected by a profile PIN. Keep sensitive data out of the lesson file itself.
- Student voice commands are processed locally where supported; their raw audio
  is never stored. Teacher lesson recording is explicitly enabled and permission
  gated, with a visible microphone status. Use a close teacher microphone and
  pause/mute capture for student speech and classroom discussions. Only teacher
  audio is intended for recording; the browser cannot isolate individual voices.
- Stopped teacher audio and source-linked visual cues stay in the teacher's local
  IndexedDB as a private review draft. Review instructional accuracy, timing and
  privacy before separately approving the recording for encrypted learner export.
  No recognition, voice cloning or automated source verification occurs. Explicit
  publication uploads only reviewed teacher media and manifests to the configured
  local service; drafts are never uploaded automatically. No cloud is configured.
  Browser recordings in tests use simulated inputs, never children or classrooms.
- Personalized SVG scenes are prepared manually from the reviewed notes and selected
  by explicit simulated profile-history rules. They are not generated transcripts,
  trained recommendations or a diagnosis of learner types. Teacher visual approval
  is separate from audio approval. Shared stored audio is encrypted; its key remains
  inside each learner's PIN-protected snapshot. Public demo PINs are not production
  authentication, and same-origin scripts can access unlocked content.
- The demo delivery service binds to loopback and saves teacher audio plaintext
  on the local filesystem, alongside PIN-encrypted manifests. Its default
  publication token and demo PINs are public fixtures. Random audio capabilities
  reduce accidental access but are not identity verification. Deploying public
  media needs authenticated teacher publication, authorized learner delivery,
  HTTPS, managed storage and retention controls; none are claimed here.
- Teachers see aggregates by default and can inspect received pseudonymous events
  and original questions. Learner snapshots stay encrypted on the device and are
  sent to the configured school lesson service or explicitly exported files. The
  current service is loopback-only and uses simulated profiles; no external AI,
  analytics or cloud speech service receives learner questions or recordings.
  Do not claim school-exclusive storage for a deployment configured to use an
  external provider: that receiving service can access submitted learner context
  and must be disclosed. PIN encryption is not anonymity or complete access control.
- The local school service accepts encrypted simulated progress only for its
  currently published lesson/recording and the correct demo learner. It validates
  contextual IDs, rejects stale/conflicting history and invented returned answers,
  saves atomically, then acknowledges the submitted digest. Failed requests never
  remove local events or questions. Returned teacher answers merge into the active
  learner only. Teacher received records also persist encrypted and are validated
  again on restore. These public demo credentials are not production authorization.
- Shared-device storage validates learner ownership before reading or writing a
  snapshot. Lock before handing over the device; profile selection clears pending
  authenticated recovery data. Public demo PINs, six-digit entropy, unlocked tabs,
  same-origin scripts and browser storage eviction limit privacy. Use one learner
  tab at a time; there is no cross-tab lock or production account system. See
  [shared-device verification](shared-device-verification.md).
# Companion voice sessions

GPT-Live extension: explicitly started connected avatar conversations send live
microphone audio to OpenAI. The project key and fixed session configuration stay
on the local Node service. New instructional responses wait for the existing
source-checking backend; live paraphrases and recognition accuracy cannot be
guaranteed. Device-reported transcripts are PIN-encrypted with the learner's
records and visible to teacher oversight, including potentially suppressed speech.
They are not approved offline package content. Offline help retains the prepared
clip path; the live stream itself is not cached. No real children's data is allowed
in this prototype. See connected-tutor.md for consent, lifecycle and provider limits.

Sprint extension: the default prepared companion behaviour below is preserved.
An additional explicitly opted-in connected coach can use OpenAI transcription,
sourced generated replies and AI speech. It sends question text, relevant lesson
excerpts, recent same-concept conversation and observed interaction details to
OpenAI; short microphone questions send audio too. This is not school-only data
processing or verified offline recognition. Only fictional profiles are permitted
in this prototype. Generated responses are logged and can be flagged rather than
requiring individual teacher preapproval. Offline package content still requires
teacher approval. See [connected tutor](connected-tutor.md) for storage, data flow,
source-check limitations, consent and remaining deployment requirements.

The recorded companion explicitly enables browser-local recognition only after a
capability check; it does not install recognizers or use a cloud fallback. Listening
status waits for the service start event. Only clear final results are routed, and
ordinary speech outside a named invocation is discarded. No student raw audio is
stored. Opted-in follow-up question transcripts are preserved verbatim in the
existing encrypted, owner/context-bound records; procedure confirmations are not
mastery evidence. Recognition stops during companion audio, physical activity,
lock, page exit, blur and hiding. Real-device offline recognition remains unverified.
The companion speaks approved prepared explanations and procedural prompts using
bundled generic local-system narration. It does not imitate the teacher, replace
classroom audio, generate teaching content or call an external AI service. Shared
device/privacy limitations above still apply. See companion-verification.md.
