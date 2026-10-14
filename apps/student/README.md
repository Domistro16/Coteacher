# Offline student player

Run `npm run dev:student` for a local interaction preview. For offline reopening,
build and serve the production bundle; see the root README.

Unlock Student A (111111) or Student B (222222), collect their reviewed demo
package or import an encrypted teacher export, then wait for **Ready offline**.
Learning, matching, quizzes, activity navigation, exports, and returned-answer
imports use local data only. Network availability never implies that progress
has been transferred.

The personalized route selects the first variant for each concept and orders
other choices. The teacher timeline and learning objective stay shared. Student
A has an optional refresher; Student B begins refraction step by step. Learners
can return to the teacher's original at any time.

Every explanation, diagram, quiz feedback, and activity shows sources. Questions
match only above the package threshold. No-match questions stay queued with a
related explanation clearly distinguished from an answer. Quizzes prioritize
paused/confused concepts. A question after the activity also records a follow-up.

Push-to-talk requires confirmed local recognition availability. It never uses
network recognition, downloads models, or stores raw audio. Unsupported devices
offer typing. Recognized text is reviewed before sending.

Local profiles and personal file transfers use AES-GCM with PBKDF2 PIN-derived
keys. Saves are serialized; wait for **Saved on this device** before closing.
Failures show a retry action and disable progress export. Locking awaits a save.
Wrong-profile files and invalid data never replace collected progress. Returning
answers merges matching queued question IDs while preserving newer activity.

The service worker caches all build assets before activation. A small Vite plugin
generates it without an extra runtime dependency; native IndexedDB stores only
encrypted snapshots. Development mode does not register the worker.

Physical Android installation and actual device speech availability remain
unverified. Demo PINs are public and fixed; production identity is out of scope.
