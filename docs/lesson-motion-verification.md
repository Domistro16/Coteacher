# Five-second lesson motion verification

The subsequent full construction redesign supersedes the overlay effects below.
See [progressive explainer verification](explainer-animation-verification.md)
for the current implementation, acceptance and browser evidence.

2026-10-12. The existing instructional SVGs now animate in the teacher studio,
clean projector, recording review and recorded student player. The audio,
recording format, stored cues, objectives, approved variant data, learner state,
publication and offline media pipeline are preserved. No video files, raster
assets, transcription, speech synthesis or additional backend were introduced.

## What changed

- Straight-path visuals trace the approved ray in its direction of travel.
- Refraction ray visuals trace the existing change of direction at the boundary.
- Both ordered representations emphasize their existing numbered instructions.
- The pencil representation crossfades emphasis between the existing grey real
  position and gold apparent position. Neither path is bent, moved or replaced.
  Original colours, geometry, wording and source references remain authoritative.
- Cycles repeat every **5,000 ms of lesson time**. A short 240 ms fade/slide plays
  when the visual identity changes, without restarting on ordinary time updates.
- A small, subdued SVG Coteacher mark occupies a reserved bottom-right band.
  The classroom graphic has a footer; personal graphics retain their 16:9 viewBox
  with a small content inset. Marks do not cover approved text. Thumbnail duration
  badges move to the opposite corner to avoid covering the watermark.

The animations are illustrative emphasis on already approved representations,
not a simulation of measured light speed, inferred speech or a new explanation.
They do not change the curriculum objective or introduce new activities.

## Synchronization

Recorded visuals compute phase as `(audio.currentTime * 1000 - cue.offsetMs) %
5000 / 5000`. Play/resume continues from that phase; pause supplies unchanged
media time; seek selects the applicable original cue and recomputes its phase.
Playback speed follows the voice: a five-second lesson-time loop takes four wall
seconds at 1.25×. Equal-time paused/resume cues still resolve to the final cue.
Paused help representations use the captured position instead of a separate timer.

Before microphone capture, the studio uses a local presentation clock for its
current visual. During capture it switches to the existing AudioWorklet sample
count and the actual visual-cue acknowledgement. Recorded samples/offsets are
not modified. Pause freezes the clock; a paused visual change or resume starts
the new cue-relative phase exactly as the saved recording will.

The projector receives the same derived clock through BroadcastChannel, along
with the existing stable step ID. It has no independent playback oscillator and
ignores clocks for a different displayed step. Full frames are sent for concept
changes/startup; compact clock messages update time, with bounded acknowledgements
for liveness. This uses no network or second microphone.

Standalone previews/cards have their own visible presentation clock because no
teacher audio is playing there. Offscreen/collapsed previews stop their frame
updates. Media-controlled visuals never create an autonomous animation timer.
Reduced motion disables animated emphasis and transitions, leaving the approved
static diagrams and accessible descriptions/annotations visible.

## Acceptance and tests

| Requirement | Evidence |
| --- | --- |
| 1. Meaningful five-second motion for demo visuals | Pure phase tests prove identical frames every 5,000 ms, including long times, and ordered instruction/real-versus-apparent emphasis. Browser checks observe a real studio cycle and the original light/refraction ray paths. Both learner representations use the same renderer and unchanged catalog. |
| 2. Smooth switching | Keyed SVG fade/slide is present in normal motion, absent under reduced motion, and visual switching remains synchronized with the clean projector while networking is disabled. |
| 3. Pause/resume/seek | Native capture compares studio/projector times and verifies frozen phase when paused. Teacher review and offline student playback seek to 0.8 and 5.8 seconds within the first concept and receive the identical phase. Existing resume/help/restart checks continue. |
| 4. Unobtrusive watermark | SVG bounds checks verify one mark per displayed visual, inside the frame and below instructional text. Classroom/projector, A/B player and narrow-screen checks run. Screenshot review led to a smaller classroom watermark. |
| 5. Both personal variants | Real native recording produces unchanged A/B recording/objective with different assets; B shows its first approved numbered step emphasized. Personal progress and saved questions remain isolated. |
| 6. Offline motion | Downloaded audio plays from Blob/IndexedDB with app network calls blocked. The new CSS/SVG code is in the production precache; offline seeks reproduce phase and the complete help/check/return journey passes. |
| 7. Recording/package regression | Existing sample-clock, encoded media, approval, package/delivery and persistence tests pass. Successful publication/sync use the actual isolated local service. |

Checks completed:

- `npm.cmd test`: **400 tests / 21 files pass**, current generated contracts and
  TypeScript included. Four new motion tests cover loop equivalence, invalid time,
  ordered/comparison semantics and malformed clocks.
- Both production builds pass. Final student main JS is about 486 kB versus the
  prior 483 kB; teacher main is about 516 kB and retains the advisory chunk warning.
  These are build sizes, not measured phone bandwidth/performance.
- Targeted browser checks: studio/projector motion/reduced motion and the complete
  native recording → review → publication → two personal packages → offline
  playback/help → sync/teacher feedback pass (2 cases, 3.5 minutes).
- Final complete browser regression: **42/42 pass in 9.4 minutes**, including the
  new studio/projector motion test, recorder exclusion, all layouts/profiles and
  the complete native capture/personalized-offline/reconnection journey (2.9 minutes).
  Final screenshots include the smaller classroom watermark and intact diagram text.

Screenshot evidence is in `test-results/lesson-motion-studio-and-p-088df-reduced-motion-alternatives/animated-projector.png`
and `test-results/recording-native-microphon-cd55a-h-personal-offline-packages/`
(studio-live-320, teacher-recording-review, student-readable-visual-notes-320,
recorded-main-student-a and desktop/mobile player screenshots). They were
inspected. These temporary files are replaced by later browser runs.

Initial TypeScript checks caught a ref generic, nullable clock-state narrowing
and a Playwright context-option placement; all were corrected before passing the
suite. No audio, approval, package or synchronization validations were relaxed.
The longer intro test makes five-second native seeks possible; ten-second controls
are verified against the actual saved cue order. No lint configuration exists.

Final TypeScript, sourced demo-package pipeline validation and `git diff --check`
also pass. Both existing development URLs (teacher 5174, student 5175) still
return HTTP 200; refresh to load the changes. Offline verification used production
previews, since development servers do not install the offline shell.

Browser capture uses Chromium simulated microphone input with actual native
capture, encoding, decoding and playback. Media time and successful local-service
responses are not fabricated. Frame/phase tests do not establish that a human
teacher's spoken explanation matches every diagram.

## Files

- Shared visual rendering: apps/student/src/Visual.tsx, ReplayVisual.tsx;
  new lesson-motion.ts, useVisualTime.ts, VisualWatermark.tsx and lesson-motion.css.
- Recorded/paused integration: RecordedLesson.tsx, StudentPlayer.tsx, student and
  teacher style entry points. Navigation and lesson/progress models are unchanged.
- Classroom clock: teacher App.tsx, Presentation.tsx, RecordingPanel.tsx,
  TeachingCanvas.tsx, projector-channel.ts, useProjector.ts, ProjectorDisplay.tsx
  and the optional visual-cue callback in microphone-recorder.ts.
- Tests: new lesson-motion.test.ts, lesson-motion.spec.ts and motion-assertions.ts;
  recording.spec.ts/delivered-replay.ts extend real capture and offline evidence.
- Documentation: acceptance/report, architecture, browser README, sprint status
  and PROMPTS.md. No persisted schema, catalog or generated contract changed.

## Limits

- Dynamic phase updates are capped at roughly 10–12 Hz for lightweight rendering;
  transitions use CSS compositing. Physical low-end Android/GPU, projector latency,
  browser background suspension and long recordings need hardware testing.
- Reduced motion intentionally keeps instruction static. Unsupported/old browsers
  remain subject to the existing audio/browser capability checks.
- Loops follow concept/media time, not individual spoken words. No speech-following
  or transcript is inferred. Teachers still review motion and both variants against
  their actual voice before publishing; human classroom readiness remains unverified
  by simulated microphone tests.
- Newly updated application code must be loaded/cached while connected before it
  is available offline. Existing downloaded media/progress needs no format migration
  or duplicated audio, but an older offline app shell cannot acquire new UI code.
- Prepared content, simulated learner histories and deterministic visual selection
  remain labelled as before. No trained recommendation or learning-outcome claim.
