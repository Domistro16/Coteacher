# Recorded and personalized playback audit

Audit date: 2026-10-10. **Verdict: PARTIAL; do not label the actual classroom
lesson READY yet.** The complete software journey passes using native browser
capture of Chromium's simulated microphone input. An actual human teacher's
spoken lesson, its intelligibility and its semantic agreement with the visuals
remain **UNVERIFIED**. No speech synthesis substitutes for that missing evidence.

The application does capture, save and play audio; this is not a slides-only
test. Production-built teacher/student interfaces and an isolated, real local
Node delivery service were exercised. Successful recording, publication, media
delivery, synchronization and answer return were not mocked. Learners, source
materials, personalization histories and the deferred prepared-answer provider
are explicitly sprint simulations.

## Requirement verdicts

PASS means observed application behavior/assertions passed within this browser
test scope. PARTIAL identifies the missing human-classroom evidence, rather
than treating synthetic microphone sound as the teacher's voice.

| # | Requirement | Verdict | Actual evidence / limit |
| --- | --- | --- | --- |
| 1 | Teacher audio is recorded and saved | PARTIAL | Native getUserMedia → AudioWorklet → Opus capture saved 6,477 ms / 19,205 bytes. Teacher IndexedDB survived reload; the local service persisted the Ogg file. Input was simulated, not a human teacher. |
| 2 | Visual transitions have timestamps | PASS | Saved cue offsets were **0, 2738, 4128, 4128, 5317 ms**, tied to stable `step-light`/`step-refraction` and `light-path`/`refraction` identifiers. |
| 3 | Recording and visuals remain synchronized | PARTIAL | Native playback crosses the correct cue; pause freezes audio time, muted capture excludes paused time, and resume retains the sample clock. Decoded duration agrees with the stored duration. Actual spoken words matching visuals are unverified. |
| 4 | Teacher reviews before publication | PASS | Playback and cue seeking work. A review checkbox alone cannot approve until playback occurs. Recording and both visual sequences require persisted approval; exports are blocked beforehand. |
| 5 | Approved lesson produces personal packages | PASS | Both encrypted packages decrypt/validate, retain the approved recording and objective, and publish through the actual service acknowledgement. Draft audio/visual review and incomplete assets are rejected. |
| 6 | Learner A receives playable personalized lesson | PARTIAL | A streams and then plays locally stored capture audio with straight-ray and apparent-pencil diagrams. Non-silent native decoding/playback is verified; human teacher voice is unverified. |
| 7 | Learner B receives same audio, different visuals | PARTIAL | B uses the identical recording/media bytes with ordered ray/boundary annotations. A uses `refraction-pencil`; B uses `refraction-steps`. Both play, but the captured input is synthetic. |
| 8 | Personalization preserves objectives | PASS | A/B objective objects are deeply equal to each other and the approved original. Cue chronology is unchanged. Assets reference `notes-light`; no new objective or teacher audio is generated. |
| 9 | Play, pause, seek and resume | PASS | Native currentTime advances, pause stops playback, progress/section seeking and ±10-second controls work; 1.25× speed and expanded player also work. Saved position restores. |
| 10 | Seeking updates audio and visual | PASS | Home/End, chapter and section controls set audio position and change the stable active step/concept and assigned visual. Teacher preview switches A/B visuals without changing the audio source or position. |
| 11 | Pause at exact concept for help | PASS | Keyboard activation opens the existing contextual panel, captures refraction and playback time, answers the prepared pencil question offline, and switches to an approved step representation. |
| 12 | Return after adaptive interaction | PASS | Offline help/check and a correct understanding check return to the same recording position; playback resumes and the assigned pencil representation returns. Closing B's check preserves its paused position. |
| 13 | Offline reopening preserves playback/personalization/progress | PASS | Network disconnected with `context.setOffline(true)`; reload and closing/reopening the PWA page restore PIN-separated state, chosen help visual, audio position and progress. Both learners resume independently; attempted app-network calls are zero. Full OS/browser-process restart and physical Android are unverified. |
| 14 | Required media/visual assets are stored offline | PASS | Complete byte-count/checksum download precedes Ready offline. Audio plays from a local Blob; vector assets/timeline are in encrypted IndexedDB snapshots and the production shell is precached. A/B share **one** encrypted media record. Truncation, corruption, missing media and quota refusal never report readiness and preserve learning records. |
| 15 | Personalization provenance is honest | PASS | Packages contain `simulated: true`, `prepared-support-rules-v2`, the decision/basis/reason, and approved catalog IDs. UI labels the simulated demo. These are deterministic prepared variants, not trained AI or permanent learning styles. |

## Fresh verification and captured evidence

Commands run for this additional audit:

```text
npm.cmd exec -- playwright test tests/e2e/recording.spec.ts --grep "native microphone capture"
1 passed (1.9m); complete browser scenario 1.8m

npm.cmd exec -- vitest run tests/recording.test.ts tests/personalized-replay.test.ts tests/recorded-adaptation.test.ts tests/progress-sync.test.ts
32 passed, 4 files
```

The browser scenario is in [recording.spec.ts](../tests/e2e/recording.spec.ts),
including [verifyDeliveredReplay](../tests/e2e/delivered-replay.ts). It executes
capture → pause/resume/manual visuals → reload/review → approve both visual
sequences → publish → A/B streaming/download → offline help/check/resume →
reconnect/receipt sync → teacher insights → returned answer → offline reopening.
The outer scenario additionally verifies school-transfer collection, package
rejection, profile isolation and media recovery.

[Captured evidence JSON](recorded-playback-audit-evidence.json) was extracted
from this run's persisted service packages and media, not fabricated fixtures.
It includes only simulated IDs, recording/approval/cue/asset/decision metadata,
audio hash and aggregate received-event counts; no keys, PINs or question text.
Both manifests refer to recording
`recording-97f4e2d0-6131-4289-84da-93361c1e2529`. The saved audio SHA-256 is
`2d47fb6227626a8fbc969e5c58d26da461e07f8dedf61fa936667cf1c36ed168`.
HTTP full media equals original captured bytes, a range request returns 206,
and native decoded RMS exceeds 0.0001; non-silent signal is not proof of speech.

Fresh screenshots are under
`test-results/recording-native-microphon-cd55a-h-personal-offline-packages/`:
projector-live-recording, teacher-recording-review (320/768/1440),
student-home-real-mobile/desktop, student-player-real-desktop,
student-readable-visual-notes-320 and student-expanded-readable-notes-320.
These are temporary artifacts replaced by subsequent browser runs. The readable
320px visual was inspected; assertions verify notes and controls fit the actual
viewport, not merely that text exists in the DOM. Full-page screenshot capture
can paint the offscreen skip link; the test separately verifies its unfocused
DOM bounds are offscreen.

The preceding [safety audit](sprint-safety-audit.md) records the same-day full
396-unit-test regression, all 37 browser scenarios across the broad run and
corrected rerun, generated-contract checks, TypeScript, both production builds
and package validation. Those broad checks were not repeated for this
documentation-only addition. No lint configuration exists.

## Timing, package and offline implementation

Capture timestamps count accepted microphone frames at 48 kHz. Paused frames
are not appended. Visual cue messages use that same frame count; the two equal
4128 ms cues represent a visual change while paused and the resumed visual,
not additional silent audio. The native player's currentTime selects the latest
cue at or before playback time; timeupdate, seeked and a 100 ms visual update
drive the display. Audio remains the clock at different playback speeds.

Each personal manifest contains the original recording reference/reviews,
concept cues, per-cue visualAssetId, approved vector layers/sourceRefs,
objective, explanations, activity and checks. Streaming uses real loopback HTTP
media. Download validates complete bytes and SHA-256 before committing encrypted
media to IndexedDB. Per-profile manifests/progress are separately PIN encrypted;
a shared media ID avoids storing another audio copy for B. Offline playback
decrypts to a Blob URL and needs neither remote streaming nor runtime AI.

Contextual help stores the exact question, learner/lesson/concept/recording IDs
and playback timestamp. Prepared answers are source-linked and immediate.
Unsupported questions persist honestly as pending. Actual server receipts mark
only acknowledged event/question IDs synchronized; retry does not duplicate
events and an older response does not discard newer local work.

## Feedback leg of the journey

The persisted service received **25 unique A events**, **6 unique B events**,
and **3 A questions**, with no B questions. The teacher's received-data view
reported **2/2 learners with refraction support signals** and **one incorrect
check**, linked to the original classroom appearances. A separate seeded view
shows the clearly simulated 4/18 cohort; it is not presented as live results.
The teacher can inspect the actual contributed question/visual and reopen the
approved activity without modifying preparation.

One A question received a returned source-grounded safety answer via the real
service. Its provider is explicitly `simulated-prepared`; the correct learner,
concept and recorded timestamp survive answer merge and offline reopening.
Other unexpected questions remain pending. This proves transfer/retrieval,
not a general external AI answering capability or improved learning outcomes.

## Remaining readiness requirements

- **Classroom demo blocker:** record a human teacher teaching the approved
  material, listen to the complete recording, review both personalized sequences
  against the actual words, approve, then repeat download/offline playback and
  feedback with that recording. No such recording was supplied or independently
  verified in this audit. Synthetic audio or prepared compatibility narration
  does not satisfy this requirement.
- **Phone demo prerequisite:** secure hosting/service access plus a physical
  intended Android/browser test. Desktop Chromium viewport/PWA reopening is not
  evidence for microphone quality, OS termination recovery or low-end hardware.
- Public demo PINs/tokens, absent production authorization, cross-tab session
  coordination and recorded-speech captions remain limitations described with
  severity in the safety audit. A close teacher microphone cannot guarantee
  exclusion of other classroom voices; pause before conversations.
- Cloud delivery, learned recommendations, arbitrary deferred AI answers,
  transcription and automated speech-following are not configured/implemented.
  The working service is local; offline requires initial complete collection.

No runtime, schema, lesson content, student/teacher design or existing learner
record was changed by this additional verification. New audit acceptance,
report and evidence files were added; PROMPTS.md and the safety-audit link were
updated. The user-owned technical-audit.md was preserved.
