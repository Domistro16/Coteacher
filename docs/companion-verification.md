# Coteacher recorded-lesson companion

2026-10-12. The recorded player now opens a conversational, speaking SVG companion
at the actual paused classroom moment. This is a **prepared lesson coach**, not a
live generative AI service. Teacher/student dashboards, native classroom recording,
original cues, packages and learner ownership remain in the existing architecture.

## What is implemented

- Explicit voice mode requests an installed local English recognizer. It never
  falls back to cloud/webkit recognition or silently downloads a language model.
  “Listening” appears only after the recognition start event. Permission errors,
  unclear transcripts and absent capability have usable text/tap fallbacks.
- Only a clear final named interruption, such as “Coteacher, I don't understand
  this”, pauses the lecture. Other classroom speech is ignored outside the help
  conversation. The native audio element captures the exact paused timestamp and
  cue; it does not use the last five-second progress checkpoint.
- A friendly original violet/mint SVG companion responds to actual prepared clip
  playback and time. Its mouth animation is stylized, not phoneme inference.
  Blinking/listening motion and mouth movement respect reduced-motion preferences.
- An approved alternative speaks, supported by a concept animation on the
  companion's own audio clock. The original teacher clock stays paused. The
  companion asks whether it makes more sense or whether there are more questions.
- Whole-phrase confirmations, another-explanation/check/return commands and exact
  spoken quiz-option selections drive the conversation. Questions containing
  command words stay questions. A compact text composer and hold-to-talk transcript
  alternative remain accessible.
- Follow-ups use the original concept-scoped matcher, unchanged confidence gate,
  approved alternate phrasings and a few explicit meaning equivalents (for example
  “seems crooked” / “looks bent”). This is conservative deterministic matching,
  not an embedding model or general semantic reasoning. Unknown terms still
  defeat matching; unsupported questions are never answered from related material.
- Supported answers speak their exact approved text and show source references.
  Unsupported questions speak an honest prepared deferral and retain their entire
  original text, learner/lesson/concept/recording IDs and timestamp in the existing
  durable queue. Saving status distinguishes acknowledgement from a failed write.
- A learner's confirmation offers a targeted check, without adding a mastery or
  quiz-success event. The actual answer/retry uses the existing profile-owned quiz
  events and speaks approved feedback. The original recording resumes only after
  companion audio is stopped, from its saved native position.
- The mic suspends during companion speech and physical activity. Lock, page exit,
  blur and hidden-tab transitions stop recognition. Stale capability results,
  transcripts, old recognizer errors and queued restart timers cannot reopen it.
  Restoring the app prepares captions/speech but never reenables microphone mode.

The voice explanation uses the approved pencil comparison for water-to-air
refraction, instead of pairing that wording with the generic air-to-water ray
sketch. Both approved representations remain selectable; manual selection pauses
speech, and speaking that explanation again restores the compatible visual.
Recorded A/B package selection and geometry are unchanged. Exhausted help now
reopens an approved assigned visual rather than losing its visual controls.

## Speech/media and storage

Existing approved explanation, answer, activity, quiz and feedback MP3s are reused.
Three new procedural prompts were prepared with the installed **Microsoft Zira
Desktop** voice, not a teacher imitation: understanding, check offer and honest
deferral. They add 94,791 bytes (about 93 KiB). The generator now retains existing
caption-hashed clips rather than regenerating them. Its first sandboxed SAPI call
was denied; an approved elevated retry generated the three local clips successfully.
No external speech or AI provider received audio, questions or identities.

The exact-caption narration manifest and all MP3s are included in the existing
production service-worker precache. The recording remains its independent shared,
encrypted local media object. There are no new persistent schema fields: questions,
viewed variants/visuals, checks and native resume position use existing contracts
and encrypted learner snapshots. Conversation presentation/self-report state is
temporary; saved questions/checks/position survive restart. Deferred answer delivery
continues through the existing acknowledged school service/transfer workflow.

## Files changed for this request

- Student integration: StudentPlayer.tsx, RecordedLesson.tsx, recorded-help.ts,
  styles.css; new CompanionVoice.tsx, CoteacherAvatar.tsx, companion.css,
  companion-intent.ts, voice-session.ts and useCompanionSpeech.ts.
- Shared prepared prompts/matching: packages/shared/src/narration-content.ts and
  matcher.ts; no schema or generated-type change.
- Clip preparation: pipeline/src/narrate.ts, fixtures/demo-lesson/narration.json;
  apps/student/public/audio/3b0f0997ac16986c7480.mp3,
  1e05b431346ee00de9d8.mp3 and 5a31e60dc3586f52299c.mp3.
- Tests: companion.test.ts, recorded-adaptation.test.ts,
  tests/e2e/companion-conversation.ts, delivered-replay.ts, recording.spec.ts and
  opus.spec.ts.
- Recording reliability: apps/teacher/src/opus-encoder.ts now feeds complete
  960-sample codec frames using one bounded residual buffer. Final padding is
  excluded from the original-sample EOS duration and all classroom cue clocks.
  The queue budget remains approximately eight seconds of PCM.
- Acceptance/report, architecture/matcher/privacy/demo/browser documentation and
  PROMPTS.md session record.

## Verification status

`npx.cmd playwright test`: **43/43 PASS, 8.7 minutes**. The full native recording
scenario passed in 3.5 minutes. Its only simulated inputs are Chromium's microphone
signal and an explicitly labelled local recognizer. Actual audio encoding, decoded
teacher/companion media, timeline, delivery service, offline cache, encrypted
storage, questions, quiz attempts, receipts and teacher insights are exercised.

| Requirement | Result and evidence |
| --- | --- |
| Named spoken interruption / tap help | PARTIAL: recognizer wiring passes simulated input; actual-device recognition remains unverified. Tap works. |
| Exact paused timestamp and concept | PASS: native audio time, current cue and recording ID checked in dialog and saved events. |
| Animated companion | PASS: actual clip clock changes mouth; reduced motion freezes it; 320px and desktop screenshots inspected. |
| Approved alternative spoken with visual | PASS: real MP3 decoding/positive audio energy, approved text/refs and compatible pencil asset checked offline. |
| Ask whether learner understands | PASS: bundled understanding prompt finishes naturally before listening resumes. |
| Voice / text responses | PARTIAL: typed input and simulated final voice transcripts drive the same conversation; target-device voice input is unverified. |
| Spoken prepared follow-up | PASS: pencil paraphrase matches the approved answer; actual caption-hashed MP3 and source/context event checked. |
| Unsupported offline question | PASS: honest spoken deferral; exact whitespace-preserving text and learner/lesson/concept/time survive reopening. |
| Confirmation offers targeted check | PASS: no quiz-success event from self-report; current refraction check appears and speaks. |
| Quiz results belong to learner | PASS: exact-option input records genuine correctness/attempt event; A/B histories stay separate. |
| Resume original recording | PASS: companion stops; native teacher audio resumes from the preserved pause position. |
| Prepared conversation offline | PASS: network-disabled production PWA plays cached MP3s and visuals; reload/profile/school-return checks pass. |

Screenshots are generated in
`test-results/recording-native-microphon-cd55a-h-personal-offline-packages/`
as `companion-320-speaking.png` and `companion-desktop-speaking.png`.
The existing repeat-help defect (controls disappeared after all visuals were seen)
is fixed and covered by a regression and the complete browser journey.

Final `npm.cmd test`: **414/414 PASS in 22 files, 46.09 seconds**, including
generated-contract and TypeScript checks. An earlier run timed out in nine
existing crypto-heavy checks; the final unchanged command passed without
increasing any crypto timeout. Near-miss specificity remains 100% (0/11 false
matches), plus paraphrase/unknown-term and voice lifecycle regressions. This small
evaluation does not establish general-language accuracy.

`npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: PASS, valid
light-and-refraction lesson, explicitly `simulated: true`. There is no lint script
configured. The teacher build retains its advisory for a bundle over 500 kB;
neither build failed.

Final availability checks: teacher development server on 5174 and student
development server on 5175 both return HTTP 200. The configured local delivery
service on 8787 returns HTTP 200 from `/api/health` with `cloud: false`.
Offline evidence above comes from production PWA previews, not Vite development
servers. Whitespace validation passes with Windows CRLF treated correctly.

Both final production builds and final TypeScript check passed. The first native browser run failed
before the companion because simulated microphone initialization had not completed
within its five-second assertion. Its startup wait now allows 30 seconds while
still requiring the actual recording status. The scenario's ten-minute budget
allows naturally spoken conversations; recording duration is checked against
decoded audio/sample-clock evidence rather than an arbitrary 30-second ceiling.

Later native runs exposed an intermittent encoder tail failure before the avatar
journey. Diagnostics measured 1,970,304 input samples versus 1,966,080 encoded
samples plus a 312-sample decoder delay; the existing completeness guard correctly
refused to save/publish. The encoder now supplies exact 20 ms frames with an
original-duration-trimmed final frame. The native codec tests pass a complete
121-second audible, finite, seekable recording and all 15 AudioWorklet stop
remainders, including intermediate partial pause buffers. The fast synthetic
producer now respects the actual codec queue; seeking waits for actual native
clock advancement instead of assuming playback starts within 350 ms. The
[Ogg Opus end-trimming contract](https://www.rfc-editor.org/rfc/rfc7845.html#section-4.4)
preserves original duration while removing codec padding. The rebuilt full
classroom-to-personalized-offline-companion-to-school-feedback journey now passes.
Publication waits for real acknowledgement (up to 60 seconds in this test), and
the pending-question assertion checks the actual durable Saved-on-device state.

## Limitations and honest capability boundaries

- **Native offline recognition on a real target device: UNVERIFIED.** Browser
  wiring is tested using an explicitly simulated recognizer; that does not prove
  its language model, microphone accuracy or Nigerian-accent performance. Local
  recognition availability differs by device/browser. Tap/text always works.
- Interruption occurs when the recognizer supplies a clear final transcript; it
  may lag the start of the spoken phrase. The saved timestamp is the actual moment
  at which the lecture pauses, not an invented speech-onset timestamp.
- **Live generative tutoring AI: not configured.** Teaching text, visual choices
  and spoken prompts are prepared. Unanticipated questions wait for reviewed
  guidance; reconnection alone cannot guarantee an answer. Arbitrary returned
  guidance remains readable in the existing question history and may lack a clip.
- Avatar motion follows decoded playback state/time; it is not a generated face,
  emotion detector or scientifically validated tutoring model. Confirmation and
  a correct check do not demonstrate long-term learning.
- Physical speakers/microphone, classroom echo and low-end Android performance
  require manual checks. Headphones help prevent the opted-in mic hearing the
  lesson playback. The browser cannot identify which person is speaking.
- Browser autoplay policies may require tapping Listen/Hear Coteacher. Failed or
  missing clips retain readable captions and a retry control; no fake speech or
  remote synthesis substitutes for them.
- Installed PWAs need one connected shell update to acquire the new clips/UI.
  Conversation history beyond saved questions is temporary. Existing demo PIN,
  unlocked-tab and same-origin privacy limits in safety-and-data.md still apply.
