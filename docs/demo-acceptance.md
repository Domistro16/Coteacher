# Working demo acceptance

Use production previews from README.md. Developer previews do not register a
service worker. All data, personalization, class statistics, and generation are
simulated and visibly labelled.

## Main journey: collect at school, study offline, return progress

1. In the teacher workspace, load the reviewed demo materials or upload
   fixtures/demo-lesson/teacher-notes.md and activity-notes.md. Generate the
   simulated draft, inspect variants/questions/quiz/activity safety, acknowledge
   review, approve, and export Student A's encrypted package.
2. Open Teach / projector. Advance visuals with a tap; demonstrate the refraction
   moment and its sources. Open Class insights to show the 18 seeded learners,
   variant observations, and previous-cohort nudge.
3. In the student app, choose Student A, unlock with 111111, import the personal
   file, and wait for Saved on this device and Ready offline. Enable narration
   once after unlocking; captions remain visible with Play/Pause/Replay/Speed.
4. Disable the connection. Reload or close/reopen the student app. It asks for a
   PIN and restores the lesson. Advance to refraction and type
   "Pause here. I understand this part, but I don't understand this" or tap
   Pause here / explain again. The different explanation shows its source and
   original lesson moment. "put it another way" and "explain that again" show the next
   unseen text variants in the learner's route order without advancing the step.
   After all text variants have been seen, "break it down" shows honest
   exhaustion and offers Try it separately or typing a specific question.
   Enable narration again after an offline reload/unlock. Hear explanations
   while the connection is disabled, pause/resume/replay them and change speed.
5. Run the safe Try it using adult help, an unsharpened pencil, a plastic cup,
   room-temperature water, and a towel. Read why it works and return to the
   teacher's original moment. Interrupt/reopen midway to verify saved position.
6. Ask "Why does the pencil look broken?" for a sourced match. Ask
   "Should I use a glass cup for this activity?" for an honest no-match and queue.
   Ask "How does a rainbow form?" to show an unsupported question staying pending.
7. Take the quiz selected from the pause point. Feedback cites sources. Wait for
   saving, then export the encrypted progress record. Prompts/options and both
   correct/incorrect feedback have captions and narration.
8. Lock/switch to Student B (222222), collect the demo lesson, and see stepwise
   refraction first. "can you say it differently" shows B's unseen teacher
   original, even after A has exhausted explanations. Student A's explanation
   history, position, questions and quiz remain separate.
9. Restore connectivity. In Class insights, enter 111111 and import A's progress.
   Refraction confusion increases from 12/18 to 13/19 learners. Variant counts and
   the pending-question total update. Importing the same file again is rejected.
10. Expand Review imported queued questions, run simulated answer return, and
    export the encrypted returned file. Only the plastic-cup safety question gets
    a sourced prepared answer; the rainbow question remains pending.
11. Unlock A and import returned answers. The sourced answer appears in saved
    questions without losing newer local progress. Connection alone never implies
    that a file was transferred.

## Second journey: bundled collection and sharing one device

Unlock A, Collect demo lesson, wait for Ready offline, disable connectivity,
advance and pause, save, close the tab, reopen offline, and unlock again. Wrong
PINs fail; progress restores. Switch learners and demonstrate independent routes
and progress on the same device. Export questions/progress for the next visit.

## Automated evidence

Real cached MP3 playback is tested with networking disabled, without mocking
Audio.play or media time. Tests check decoded duration and advancing time,
pause/resume/replay/speed, the complete preparation queue, every activity
instruction and its why, quiz feedback, matched/no-match replies, reload,
microphone fallback and locking/switching profiles. Speech-synthesis unit tests
cover local voices, delayed voice availability, remote-only rejection, media
errors, autoplay restrictions and cancellation races.

Help acceptance covers unscripted current-step words, normalization of curly
apostrophes/capitalization/spacing, manual views, optional refresher views, and
history after navigation and offline reload. Specific text after "but I don't
understand" is sent to the unchanged matcher at the current step: sourced
answers show their own lesson moment without moving the player; specific
no-matches are queued without the help command prefix. Generic "this", "that",
"it" and "this part" suffixes do not create empty questions for the teacher.
Unrelated questions and command near-misses such as "Why do we repeat the
experiment?", "I didn't get that parcel" and "Explain how a rainbow forms again?"
use the matcher or honest no-match without activating a command. Unscripted
confusion such as "The bit with the water still makes no sense" is passed intact
as matcher context. On no-match it is saved and a sourced unseen explanation is
offered as related material. Exhaustion offers an activity
only where a safe Try it exists, and the typing action focuses the question box.

npm run test:e2e builds both apps and runs the main journey, bundled offline
reopening, profile/file/source/storage error cases, narrow layouts, keyboard/touch
navigation, activity exit, and unavailable-speech typing. It enables service
workers and blocks student application network APIs in the main journey. The
in-process preview servers close normally on Windows.

npm test checks generated types, app/pipeline types, contracts, local generation,
matcher negatives/paraphrases, encryption, quiz selection, snapshot imports,
answer merging, and local speech adapter behavior.

A real low-end Android installation/performance/speech check remains unverified;
see docs/sprint-status.md. Typing is the reliable fallback when local speech is
unavailable. Generation and answer return do not invoke live AI.
