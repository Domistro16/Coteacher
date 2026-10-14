# Spoken quick-check routing and stopped live playback

The operator confirmed live startup worked after progress recovery. Their saved
live transcript reads "Yeah, I would love to try a quick check". That phrase was
treated as a teaching question because the command matcher recognized "would
like" but not "would love". The configured tutor generated "When light moves
from one material to another at an angle, does it travel in a straight line or
change direction?" instead of opening the approved quiz.

The operator then heard the question with an understanding prompt after switching
windows. Window blur ends live capture. Previously, the answer effect could then
automatically play cached AI speech, including speech arriving after capture had
stopped. The provider appends the understanding prompt to downloaded AI speech;
the hearing report alone did not establish that a bundled offline clip played.

The bounded fix recognizes the anchored "would love" check request and tracks
questions delegated during the current live session. Their answers remain saved
without automatic downloaded playback after ending live capture. Explicit
"Hear saved answer" remains available in the existing question history. Approved
quiz question/options still use their bundled audio; no extra understanding
prompt is appended to that quiz playback. The recording, source checks, existing
layout, encrypted histories and school validation are unchanged.

Validation evidence: `live-check-audio-evidence.json`. Its microphone, live
transport and answer provider are mocked; bundled MP3 playback uses the native
media element. This is control/playback evidence, not corrected human hearing
proof. The operator subsequently confirmed audible student playback (**PASS by
operator report**). Overall rehearsal is **PARTIAL**, with other human journey
checks still **UNVERIFIED**.

The previous production build reproduced both failures in
`live-check-audio-before-evidence.json`. The corrected run **PASS**ed delayed
answer suppression after window blur, explicit saved-answer playback, opening
the approved quiz for the exact saved spoken phrase, one question/options clip
through its native end event, no extra understanding clip, retained 1,935 ms
lesson position, persisted correct quiz evidence and return to recorded playback.
It checked unchanged desktop player dimensions, no dialog and 360 px layout
without horizontal overflow. Screenshots are in `.task-tmp/quick-check-*.png`.

Regression commands: `npm.cmd exec -- vitest run tests/companion.test.ts
tests/progress-sync.test.ts tests/live-voice.test.ts` (**28 PASS**), `npm.cmd run
typecheck` (**PASS**), and `npm.cmd run build` (**both apps PASS**, existing size
advisories). Browser command: `npm.cmd exec -- tsx
.task-tmp/verify-live-check-audio.ts` (**PASS**). The original phrase regression
failed before changing the matcher. Test setup refinements corrected the saved
home button label, waiting for downloaded speech after the earlier text result,
and a nested-summary selector; those setup failures were not product evidence.

The existing student preview at port 4173 serves `index-JpjJ3U2Q.js` and
`StudentPlayer-DyprdMsw.js`, verified byte for byte against the new local build.
Existing services were retained. Teacher recording/timing was subsequently
confirmed by the operator. The two audible live turns, human quiz routing,
single downloaded voice and real microphone shutdown/resume checks retain their
separate unverified statuses.
