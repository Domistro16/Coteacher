# Docked lesson companion — 2026-10-14

The recorded student player uses a contextual companion within its own layout.
There is no tutoring dialog, backdrop, tabbed application or modal quiz. Desktop
reserves a right-hand column with the avatar beside its speech bubble near the
bottom; tablet/mobile place the dock below the canvas and native controls. The
chat/source/settings area scrolls independently of text input and resume.

## What changed

- `apps/student/src/CompanionDock.tsx`: semantic non-modal companion region,
  context/paused time, dismiss/Escape, keyboard focus return, conversation area,
  persistent input and explicit recording resume.
- `StudentPlayer.tsx`: conversational help, confirmation/check, activity and saved
  questions are composed into this dock. Existing modal/showModal and explanation
  tabs are removed. Source references, representation choices, recommendations
  and voice/connection settings remain available as secondary details.
- `RecordedLesson.tsx`: optional companion slot and approved paused-support visual
  on the main lesson canvas. Teacher review callers retain their normal layout.
- `CompanionVoice.tsx`: the existing animated avatar and genuine prepared/native
  speech use the dock; activity/check speech has a compact presentation. The
  microphone control lives beside the text composer.
- `companion-dock.css`, `styles.css`, `student-ui.tsx`: responsive reserved space,
  bounded speech/settings, readable teaching text, accessible controls, microphone
  icon and reduced-motion entrance. Teacher styling is not redesigned.
- Browser helpers/tests: dock geometry and context assertions replace modal/focus
  trap checks, and secondary controls are opened through their actual menus.

No schema, recording identifiers, approved package assets or backend services
were replaced. Existing prepared matching, safe activities, quiz events, encrypted
progress, source-checking tutor jobs, learner memory, microphone transport,
acknowledged synchronization and media download/storage are reused.

## Conversation and clock

Talk with Coteacher / I don't understand dispatches the existing recording-scoped
request. Native audio pauses and supplies the exact millisecond position and cue.
Help selects an approved explanation and compatible prepared visual, immediately
plays its actual bundled speech, then asks whether the student understands.
The main canvas follows companion audio time while the original teacher clock
stays frozen. No teacher recording, manifest or timeline is rewritten.

If connected tutoring is already enabled, the help tap also saves an explicit
request for a different sourced explanation at that moment. Its checked generated
MP3 replaces the approved introduction when available. This is a button-origin
request, not an invented microphone transcript. New typed/voice questions use the
existing prepared-match/connected-answer/durable-defer paths in the same UI.
Exact typed text and original learner/lesson/concept/time attribution remain intact.

Confirmation offers the approved concept check; it does not declare mastery.
The prepared activity and its subsequent check stay in the dock. Return to
recorded lesson stops companion audio/microphone, removes paused support and
resumes native teacher audio at the preserved position. Dismiss/Escape leaves
the recording paused there. Seeking or playing the original recording ends the
old conversation so it cannot be attributed to a different cue.

Live microphone capture still requires explicit permission/consent and server
acknowledgment. The dock does not silently enable it. Prepared explanations start
without an extra Listen click after the student's help tap; blocked/missing audio
has an honest recovery/readable alternative rather than fabricated speech.

## Verification

- `npm test`: **425 tests / 24 files pass**, including generated contract checks
  and TypeScript. Recording, timing, sources, safe approval, matcher, encrypted
  profile isolation, memory/restart and receipt-backed synchronization are covered.
- Both production app builds pass. Final student build passes after the narrow
  layout fix. Existing teacher chunk-size warning remains (~526 KB minified);
  no lint script is configured.
- Updated mock-provider tutor browser journey: **PASS (2.2 minutes final run)**.
  It captures native classroom audio with Chromium simulated microphone input,
  records transitions, reviews/approves/publishes, opens the student player and
  proves automatic native prepared speech without a Listen click. It exercises
  source-checked mock AI speech, opt-in simulated live delegation, contextual
  follow-ups, confirmation/check, button-origin connected explanation, and the
  actual Return button's native play event at the preserved position.
- Geometry/focus checks pass at **320, 360, 768 and 1440px**. No student dialog is
  opened; the dock overlaps neither the educational canvas nor playback controls.
  Text input and resume are wholly inside its bounds. Original playback controls
  accept keyboard focus while the companion remains active. Seeking closes it.
- The same journey downloads complete audio/visuals, disables network transport,
  uses prepared spoken help, honestly handles unavailable local recognition,
  answers a prepared typed question, queues an unexpected question, follows safe
  activity instructions, completes its correct check, reloads offline and resumes.
  It reconnects, retrieves the queued answer, verifies distinct A/B memory and
  questions/progress, and reaches teacher oversight.
- Recording safety browser cases: **3 PASS** — denied microphone permission,
  failed durable media save/retry, and cancelled delayed permission acquisition.
  These pass in a separate run; do not represent this as a complete browser suite.
- Mobile/desktop screenshots from the final tutor run are retained under ignored
  `test-results/tutor-*/docked-companion-{mobile,desktop}.png`.

Early browser runs exposed a closed secondary-menu locator, measurement during
the 220ms entrance animation, and genuinely clipped resume controls at 320px.
The locator now opens its menu, geometry waits for the actual entrance to finish,
and reserved grid rows keep input/resume available. The final run passes these
checks plus the full offline/reconnect journey. The large legacy recording/demo
scenario was not rerun in full for this redesign.

## Honest limits

The connected browser tests use explicitly labelled mock model/voice transport;
native teacher/companion audio playback and local HTTP/persistence paths run.
They do not establish that a real person used a physical microphone or that an
Android device has local speech recognition. Real OpenAI access was verified
separately before this UI change; no new live API probe was performed here.
The configured development backend continues to report OpenAI, not a mock.

Live reasoning/recognition require a connection. Offline speech uses actual
prepared/cached audio; unprepared questions stay queued. Very short phone screens
require ordinary vertical scrolling between the visual and dock; the assistant
does not overlay them. Physical Android/speaker/microphone testing remains manual.
Existing prototype privacy, source-quality, deployment and model limitations in
`connected-tutor.md` and `live-avatar-verification.md` still apply. Predetermined
package visuals remain simulated; evidence-backed memory is not model training.
