# Recorded visual personalization and paused help

The existing approved light/refraction lesson now supports two layers of offline
personalization. Both learners use the same captured teacher audio, original
objective and cue chronology. The sprint uses deterministic rules and simulated
history, with hand-prepared, source-linked scenes; it does not train a model or
generate instructional content on the learner's device.

## Package decisions

`personalizedReplay` assembles a `prepared-support-rules-v2` manifest. Its
`decision` records the input difficulty, optional supplied preference, selected
representation and basis. The visible reason explains the decision.

| Input | Assigned scenes | Basis |
| --- | --- | --- |
| A's simulated difficulty interpreting the apparent pencil position | Straight-ray diagram and pencil/apparent-position comparison | Simulated history |
| B's simulated difficulty following boundary steps | Numbered rays and ordered boundary annotations | Simulated history |
| Explicit empty history or unknown learner without history | Prepared concrete-diagram sequence | Default |
| Supplied representation preference | Corresponding reviewed concrete or ordered sequence | Learner preference |

These inputs describe a current difficulty or preference, not a permanent learner
type. The generator API accepts a preference; the demo does not provide a profile
preference editor or automatically infer preferences from quiz outcomes.

Every new package contains all four reviewed SVG assets, while its sequence
assigns one asset to each captured cue. A and B therefore share an asset catalog
but see meaningfully different scenes during playback. The teacher can inspect
both sequences, the default and every packaged help scene before visual approval.
Existing audio and publication approval gates still enforce collection/export.

The catalog remains `refraction-visuals-v1`: the geometry and sources already
reviewed for the two sequences have not changed. Validation reconstructs the
manifest from its decision and rejects missing scenes, changed geometry, reasons,
derived decisions or cue mappings. Original `demo-history-rules-v1` packages remain
valid with their two selected scenes; they cannot offer a visual that was never
collected. Neither approval nor validation proves the truth of a citation or the
meaning of arbitrary recorded speech. The teacher must review that correspondence.

## Help at the recorded moment

1. Play or seek using the native audio controls. Use the unclear-part field or
   Pause and explain this concept. The action pauses the recording and reads
   actual `audio.currentTime`, rather than the study pane's potentially older step.
2. The cue at that timestamp determines the exact lesson step and concept.
   Prepared explanations rotate using this learner's viewed-variant history.
   Specific wording goes to the existing threshold matcher: a sourced match or an
   honest saved no-match. Unsupported questions are never answered by invention.
3. A prepared representation not yet explored at that step is suggested. Its
   source is shown; the learner can also choose a packaged representation manually.
   Suggestions use their own `visual-explored` history. Exhaustion does not invent
   another representation or imply a learned recommendation.
4. Check this concept opens the prepared check for that exact concept. Existing
   sourced feedback, safe activity and saved questions remain available.
5. Return to recorded lesson resumes the same audio at the paused position.
   Paused visual support is cleared, and the assigned sequence follows the original
   audio clock again. The recording, approved content and manifest are not edited.

Saved `visual-explored` events contain wall-clock time, recording ID, concept ID,
timeline step ID, asset ID, position in the recording and asset sourceRefs.
`PlayerState.recording.support` remembers the paused representation alongside the
existing recording position. Restore checks its relationship to the exact cue and
approved asset. Help choices and explanation variants survive an offline reload;
the transient typed draft, response notice and quiz panel openness do not persist.
The actual question, quiz answer and learning events do persist.

Interaction history already affects later prepared-help recommendations: previously
viewed explanations and explored representations are excluded. Difficulty/pause
events also feed existing pause-based checks and teacher insights. Teacher progress
import now validates against the prepared lesson's saved recording and asset catalog.
It needs the original recorded revision on that teacher origin. There is no automatic
package regeneration, cross-device history sync, effectiveness model or external AI
job queue; those are future work.

## Synchronization and local storage

The capture sample clock and original cue offsets are unchanged. Playback chooses
the last cue at/before native audio time, including seeking and equal-time paused
transitions. Package selection changes only the scene associated with that cue.
The additional representation appears only while paused, so it cannot accompany a
later concept's speech. Resume restores the assigned scene. No replacement teacher
voice, transcription or automatic speech-following is used.

The existing media strategy stores one encrypted binary audio row for both profiles;
each independently PIN-encrypted snapshot stores its manifest, all four small SVG
scenes, explanations, progress and paused support. Playback uses a local Blob URL,
with no remote stream. The service worker caches the shell and prepared narration
clips. Full media collection must succeed before Ready offline; a missing or damaged
audio file offers recollection instead of a silent recorded-lesson claim.

Playback checkpoints remain every five seconds and on pause/seek/lock. Completed
saves survive reopening; an abrupt process kill can lose the latest unsaved few
seconds. Existing snapshot ownership checks and separate histories prevent mixing
A and B's records. Public simulated PINs, single-tab coordination, device access and
storage eviction limits are documented in shared-device-verification.md.

## Verification

- `npm.cmd test`: 348 unit tests across 14 files, generated-type freshness and
  full TypeScript checks passed.
- `npm.cmd run test:e2e`: both production builds and all 24 browser scenarios
  passed in 2.4 minutes, including the extended offline help/check/resume journey.
- After adding encrypted progress return to the recorded teacher revision,
  `npm.cmd exec playwright test tests/e2e/recording.spec.ts -g 'native microphone capture'`
  ran all four recording scenarios on this Windows npm invocation; all passed in
  46.2 seconds, including the new import assertions.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: the original simulated
  source-only fixture remains valid. `git diff --check`: no whitespace errors.

`tests/recorded-adaptation.test.ts`
adds seven tests covering default/preference/history decisions, catalog completeness,
tamper rejection, legacy packages, exact native-time context, sourced matcher/no-match,
history-driven alternatives, cross-profile rejection and invalid saved-support/events.

The extended native recording browser journey records Chromium's simulated
microphone through real getUserMedia, AudioWorklet, WebCodecs and Ogg Opus. It reviews
and exports both packages, compares complete audio and original objectives/cues,
plays distinct A/B scenes, and confirms exactly one shared local media row. After
disconnecting, A asks about refraction, sees a different prepared representation and
explanation, reloads offline, restores both, passes the concept check, and resumes
the original native recording. Encrypted event inspection verifies the exact cue,
timestamp, sources and unchanged manifest; B has no A help history or paused support.
After reconnection, A exports encrypted progress and the teacher successfully imports
it against the original saved recorded revision, including the visual exploration.
Existing tests cover independent questions, quiz results and activity positions,
wrong PINs, foreign rows, offline reopening and media failure/recovery.

Media time and audio playback are not mocked. Simulated microphone input verifies
the capture/playback software path, not a physical teacher speaking in a classroom.
Actual low-end Android performance, microphone behavior and Safari/Firefox support
remain unverified. Current Chromium/Edge with AudioWorklet/WebCodecs is the tested
capture target. Browser autoplay restrictions may require a play tap. Assets are
concept-synchronized; animated highlights are illustrative, not word-level speech
alignment. Only the supplied demo lesson and two simulated profiles have a full UI.

## Files changed for this task

- Contracts: lesson-package, player-state and progress-record schemas; their
  generated shared types; shared event export.
- Shared behavior: `packages/shared/src/personalized-replay.ts` and `validation.ts`.
- Learner behavior: new `apps/student/src/recorded-help.ts`, plus `RecordedLesson.tsx`,
  `App.tsx`, `storage.ts` and the existing stylesheet.
- Teacher review/import: `apps/teacher/src/RecordingPanel.tsx` and `App.tsx`.
- Tests: new `tests/recorded-adaptation.test.ts`, existing
  `tests/personalized-replay.test.ts` and extended `tests/e2e/recording.spec.ts`.
- Documentation: this report, contracts, architecture, demo acceptance, scope,
  sprint status, browser-test README, replay report, repository README and PROMPTS.md.

The preceding shared-device task also changed profile validation/UI and added its
own storage/browser tests and report. `docs/technical-audit.md` is an unrelated
pre-existing untracked file and was not edited for these tasks.
