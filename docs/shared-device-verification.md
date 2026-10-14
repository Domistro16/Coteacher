# Two learners sharing one offline device

The existing student PWA supports two stable, explicitly simulated identities:
`student-a1b2c3d4` (Student A) and `student-b1c2d3e4` (Student B). They study the
same light/refraction lesson and objective with different prepared routes based
on simulated previous difficulties. These are support choices, not permanent
learning-style labels. Each learner can choose another explanation or return to
the teacher's original.

## Session and storage behavior

- Selecting a learner requires their PIN. An existing record opens only after
  PBKDF2-SHA256 key derivation and successful authenticated AES-GCM decryption;
  the other learner's PIN cannot decrypt it. First collection also checks the
  selected simulated profile's fixture PIN. Those public demo PINs are shown
  explicitly as simulated, not as secret production credentials.
- IndexedDB's `profiles` store keys each encrypted snapshot by stable learner ID.
  The snapshot contains that learner's lesson route, study/activity/audio position,
  explanation history, queued questions and quiz events. No entered PIN is saved
  in IndexedDB, localStorage, sessionStorage or exported progress. Salt and IV are
  fresh for each encrypted save. The unlocked PIN exists in memory for checkpoint
  encryption and file import/export until the session is locked or the page closes.
- Storage checks lesson ownership, progress identity and player relationships on
  both reads and writes. A valid encrypted payload placed under another learner's
  row is rejected; invalid writes fail before opening IndexedDB. File collection
  and returned-answer import retain their existing profile validation.
- Locking stops lesson audio, flushes the latest position and pending serialized
  saves, then removes the active session and player. Question drafts, feedback,
  narration controls and other transient learner UI unmount with the player.
  If saving fails, the existing session remains available for retry; the app does
  not switch learners or claim that unsaved work is preserved.
- Selecting another profile clears the PIN field, errors and authenticated
  missing-media recovery state. The profile/PIN fields are disabled during unlock
  so an in-flight request cannot be reassigned to another selected identity.
- Refresh/tab reopening starts locked. A correct PIN restores the exact saved
  concept, explanation and activity instruction, plus the learner's questions and
  quiz results. Replay checkpoints and lock flushing retain their existing behavior.

The bundled shell already includes both demo routes, so B can collect the same
cached lesson after the device is disconnected. Recorded packages still require
each learner's complete personalized teacher file to be collected first. Their
original audio is deduplicated in the existing encrypted media store; their chosen
visuals and learning records stay in separate encrypted snapshots. Sharing a media
asset does not share progress or questions.

## Verification

The new `tests/e2e/profiles.spec.ts` uses production bundles and the actual service
worker, IndexedDB and Web Crypto. It disables browser networking and blocks student
fetch/XHR/WebSocket calls. It exercises:

1. A collecting the lesson, advancing, saving an unmatched question, answering a
   quiz correctly, and stopping at activity instruction 2; lock flushes the record.
2. B's wrong PIN rejection, offline collection of the same cached lesson with a
   different route, absence of A's question/draft/quiz results, independent question
   and incorrect quiz result, and stopping at activity instruction 1.
3. Unchanged complete decrypted A records after B studies; distinct encrypted
   database rows/salts; failed cross-PIN decryption; no plaintext question/PIN fields
   in stored envelopes and no localStorage/sessionStorage learner records.
4. Offline refresh, wrong-PIN rejection, A's exact instruction/question/quiz/history
   restoration, and B's independent restoration after closing/reopening the tab.
5. Rejection of a foreign learner snapshot even when encrypted with the selected
   profile's correct PIN; profile selection clearing authenticated audio recovery.

`tests/profile-storage.test.ts` additionally rejects foreign row/progress/lesson,
invalid study/activity positions and foreign audio positions before any database
write. Existing full-demo, help and native recording tests continue to cover
independent explanation histories, encrypted file ownership, shared recorded media
and separate playback positions.

Command results on 2026-10-09:

- `npm.cmd test`: 341 tests across 13 files passed, including seven new storage
  ownership checks, generated-type freshness and TypeScript validation.
- `npm.cmd run test:e2e`: both production builds passed; all 22 existing browser
  tests and the new foreign-record/recovery test passed. The new two-learner test
  initially inspected IndexedDB before the async lock finished. Its helper now
  waits for the locked welcome screen; no application save change was needed.
- `playwright.cmd test tests/e2e/profiles.spec.ts`: both final profile tests passed
  in 13.4 seconds. The final tests also block network APIs in reopened tabs and
  use the actual existing incorrect-quiz feedback text. All 24 distinct browser
  scenarios therefore passed across the regression run and corrected profile rerun.

Changed files: student `App.tsx` and `storage.ts`; new
`tests/profile-storage.test.ts` and `tests/e2e/profiles.spec.ts`; this report,
architecture/safety/demo acceptance/sprint status/root README/browser-test
documentation and `PROMPTS.md`. Contracts, fixed learner IDs and encryption format
are reused unchanged. The unrelated `docs/technical-audit.md` is left untouched.

## Privacy limitations

- This is a public simulated demo with fixed, published PINs in fixture code/UI;
  no real child data is used. Six-digit PINs have limited entropy. Encryption at
  rest and functional unlock do not make this production authentication or complete
  device security. There is no retry throttling, account provisioning, PIN reset,
  signed identity, remote revocation or school-admin access control.
- An unlocked tab, same-origin script, browser developer tools, malware, browser
  extension or someone with the PIN can access decrypted records. Lock before
  handing over the device. Other already-unlocked tabs are not remotely locked;
  use one learner tab at a time. Concurrent tabs editing the same profile are not
  coordinated and can overwrite newer checkpoints.
- Stable profile IDs, profile labels, encrypted-record sizes and media existence
  are visible to someone inspecting the local browser database. Encryption does
  not hide all metadata or prevent deletion/tampering; modified ciphertext fails
  authentication. Teacher preparation and recording storage remain separate and
  are not PIN-protected teacher authentication.
- Persistent browser storage can be cleared/evicted. Save/lock before closing;
  failed saves are reported, and abrupt crashes can lose uncommitted changes.
  Saved questions persist; unsent drafts are deliberately not restored or passed
  to the next learner. Offline return-file workflows require explicit file transfer.
- Chromium refresh/tab reopening is automated. Physical Android device sharing,
  browser-process/OS restarts, installation and hardware performance remain
  unverified. The browser cannot guarantee secure memory erasure after logout.
