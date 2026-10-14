# Final human audio rehearsal

Current rehearsal status: **PARTIAL**. Student audible playback is **PASS by
operator report**: "So I think it's verified that human heairing is fine now."
Teacher recording/visual timing is also **PASS by operator report**: "Teacher
rocording/visual timing is okay too."
Two relevant contextual live turns are **PASS by operator report**: the operator
supplied both question/answer transcripts at 34874 ms and confirmed hearing both
answers through the speakers. The question-grounded personalized quiz modal,
quiz audio, microphone shutdown and saved-position resume are also **PASS by
operator report** in the guided rehearsal. One consistent voice in a newly
generated downloaded answer remains **UNVERIFIED** by a person. The quiz
implementation has also passed browser and real provider text checks; see
contextual-quiz-verification.md.
Earlier operator failures are recorded in `human-audio-rehearsal-evidence.json`.
Automated controls and provider text tests do not establish human-audio success.

On 14 October 2026, the pending progress-conflict recovery browser test **PASS**ed.
It used the production UI, encrypted IndexedDB and an isolated copy of the school
records, with mocked microphone, peer controls and live transport; no audio or
OpenAI request occurred. The unchanged school prefix (26 events and six questions)
was retained, two offline events and one question were appended, and the combined
28 events/seven questions persisted both locally and at the isolated school without
duplicate IDs. Initial tutoring synchronization returned HTTP 400, retry returned
HTTP 200, and mocked live startup returned HTTP 200. A concurrent HTTP 409 appeared;
the retry still succeeded. See `populated-live-ui-evidence.json` for this specific run.

Student/teacher previews and backend health returned HTTP 200. Student assets
`index-D0S3iNzD.js` and `StudentPlayer-YvLhhvcI.js` matched the local build byte for
byte during the recovery check. Existing services were retained; original
publication/progress/tutor files remained unchanged during the isolated test.
The operator subsequently confirmed human live startup worked. Their saved
recognized question and the backend's successful connection log supplement that
report; they do not establish all remaining audible/timing checks.

The next reported failure was quick-check routing: the saved transcript says
"Yeah, I would love to try a quick check". The matcher missed "would love" and
sent it as an AI question. Switching windows then allowed downloaded AI audio to
play, consistent with the observed understanding prompt. Both failure paths were
reproduced on the previous build. The bounded matcher/playback correction passed
28 focused tests, TypeScript, both builds and a production browser regression
with mocked live controls and native bundled MP3 playback. See
`live-check-audio-fix.md` and `live-check-audio-evidence.json`.

The current student preview serves `index-CVFIIJos.js` and
`StudentPlayer-DxRZgnbg.js`, verified byte for byte. The verified Coteacher backend
was restarted for the new check endpoint; both previews were retained. Original
publication, received progress, live history and saved answers/audio were retained.
The operator's student-hearing confirmation remains PASS. The new modal opens
on spoken acceptance and prepares a sourced check of the actual question using
this learner's observed attempts. Already saved checks work offline; missing
question-specific checks defer honestly. Reload online once for this new build.

Continue with the four remaining student checks below: two contextual spoken
turns in one live session, spoken acceptance opening the approved quiz, microphone
shutdown and saved-position resume, and one consistent voice in a newly generated
downloaded answer. Existing downloaded clips retain their original content.
Already-confirmed student hearing and teacher recording/timing need no repeat.
On an actual failure, retain the exact stage/status, time and safe backend logs
before making another change. Do not clear site data or reset either history.

## Open the rehearsal

- Teacher: <http://127.0.0.1:4174>
- Student: <http://127.0.0.1:4173>
- Backend: <http://127.0.0.1:8787/api/health>

Use ordinary Chrome/Edge with a real microphone and the output device intended for
the demonstration. Confirm microphone selection, output volume and site permission
on both teacher and student origins. Stay online for GPT-Live. Use a persistent
browser profile so recordings survive reopening. A fresh profile avoids replacing
old browser drafts or mixing rehearsal progress with earlier sessions. Keep the
existing light/refraction lesson and reviewed sources; do not invent new material.

If services need restarting, from `D:\Coteacher` run these in separate PowerShell
terminals. Existing production builds already exist:

```powershell
# Backend: uses existing .coteacher-delivery and root server-side env configuration.
npm.cmd run delivery:start 2>&1 | Tee-Object -FilePath .task-tmp/human-rehearsal-backend.log

# Student
npm.cmd run preview --workspace @coteacher/student -- --host 127.0.0.1 --port 4173 --strictPort

# Teacher
npm.cmd exec --workspace @coteacher/teacher -- vite preview --host 127.0.0.1 --port 4174 --strictPort
```

Do not start a second server on these ports while the first is running. Use the
existing `.env.local`/`.env`; the OpenAI key must remain server-side. No API key is
needed in the student page or browser console.

## Record 35–50 seconds of real human speech

1. Teacher: select the existing approved refraction lesson. If the browser profile
   is empty, Prepare lesson → Teaching materials → **Use reviewed demo materials** →
   **Generate simulated lesson**, inspect the existing sources, acknowledge review →
   **Approve lesson**. Generation and fixture sources remain labelled simulated;
   the recording you are about to make is real human speech.
2. **Teach / projector** → **Start presentation**. Start on the first light-path
   visual. **Check microphone access**, allow the real microphone, and verify it
   returns to microphone off. Enable **Record my explanation only** → **Start
   audio recording**. Wait for **Recording teacher microphone** and an advancing
   recording timer before speaking. Permission alone does not prove captured speech.
3. Say aloud in your own voice:

   “This is my human rehearsal recording. In a uniform material, light travels
   along straight paths. A ray shows the direction that light travels.”

   Let the initial visual construction finish. Click **Next visual** once as you say
   “Now we are looking at the water surface.” Note the recording timer at that click.
4. Continue aloud:

   “Light changes speed between water and air. When it crosses the boundary at an
   angle, its direction changes too. This is refraction. The pencil itself stays
   straight, but the underwater part looks shifted, so it appears bent.”

5. **Stop and save recording**. Wait for **Recording saved · review before publishing**.
   Confirm the browser microphone indicator stops. Do not approve a silent or failed
   capture. Keep the review tab open if saving failed so its draft remains available.

If a recording already exists in the teacher browser, replay it first. Keep it if
it is genuine human speech and meets this checklist. To make a separate new take
without deleting the old local draft, use a fresh persistent browser profile and
the same reviewed lesson materials. Do not silently replace a recording with TTS.

## Hear and check the saved recording

1. In Recording review, click native **Play**. A person must hear their own spoken
   words through the actual output device. Note any silence, clipping, distortion
   or missing ending. Check that the full spoken passage is present.
2. Seek just before the noted transition: the first light-path visual must appear.
   Play across it: the water/refraction visual must appear with “Now we are looking
   at the water surface.” Pause: the playhead and instructional animation freeze.
   Seek after the transition and backward again: the correct concept restores.
3. Refresh/reopen the teacher tab, open Recording review and replay. Confirm saved
   human speech and the same transition remain. Test Default, Student A and Student B:
   narration and cue timing remain the same; both visual variants must fit the words.
4. Only after listening and reviewing accuracy/privacy, acknowledge **I reviewed the
   audio and visual timing** → **Approve recording for learners**. Review both
   personalized sequences, acknowledge them → **Approve personalized playback**.
   **Publish packages** → **Publish recorded lesson**. This publishes the reviewed
   human recording through the existing local backend, for both fictional profiles.
5. Student A (`111111`): **Watch Now**. Play and hear the same teacher speech, then
   select refraction and leave playback running away from the end of the recording.
   Student B's PIN is `222222`; no real child needs to participate in the rehearsal.

## Speak two GPT-Live turns; do not type the follow-up

1. In the student player, note the native elapsed time, then **Talk with Coteacher**.
   The recording must pause. The avatar should listen before giving an explanation.
2. Enable **Enable connected tutoring and learning memory**, wait for **Start live
   conversation** to become available, click it and allow microphone access for the
   student origin. Expect **Microphone on · GPT-Live** / the live listening status.
   If the caption says connected text, prepared answer or downloaded AI voice, that
   is a different path; do not count it as a live conversation.
3. Speak naturally into the real microphone:

   “How does the curved lens in a phone camera bend light, like the water in this lesson?”

   Wait for a relevant spoken explanation. Confirm the recognized caption/question
   corresponds to what you actually said, and that you physically hear the answer.
4. After the avatar finishes speaking, keep the same session open and say aloud:

   “When you say it changes direction, is the glass bending, or is the light changing direction?”

   Verify recognition of this second question and a relevant audible answer using
   the first turn's context. Do not substitute a typed follow-up, push-to-talk upload,
   prepared audio or TTS-only fallback for this specific spoken live check.
5. Verify the avatar asks whether it makes sense / invites a check. You may answer
   the approved quick check; a correct attempt is quiz evidence, not lasting mastery.
6. Click **End live conversation**. Confirm microphone-off status and the browser's
   live microphone indicator stops. Click the companion's **Return to recorded lesson**
   play button: the panel closes, the teacher's actual recording resumes at the noted
   pause point, and its matching visual resumes. The avatar must not keep talking
   or recording over the teacher. The X/**Close learning panel** dismisses help and
   leaves playback paused; use **Return to recorded lesson** for automatic resume.

## Evidence and actual failures

The person's hearing and observations are essential. A successful HTTP request,
caption, waveform, microphone permission or decoded-audio counter alone is insufficient.

Teacher **Class insights** → **Refresh school records** → **Refresh tutor records**:
under Student A, open **Live voice conversation log**. Check both Learner transcripts
and AI avatar turns correspond to this rehearsal, with the same concept/recording
position. These are device-reported transcripts and may include suppressed speech;
they supplement rather than replace the human hearing report. Keep initial routes
and the seeded 18-learner class separately labelled simulated.

If a stage fails, preserve the saved draft/history and record:

- UTC/local time, browser version, microphone/output device and lesson pause time.
- Exact clicks and actual spoken question; expected behavior and observed behavior.
- Exact visible error/status and whether repeating the same steps reproduces it.
- Browser DevTools Network: status for `/api/tutor/.../live` and `/api/tutor/...`,
  and relevant Console error text. Do not share keys, Authorization headers or raw
  connection credentials; copy only status and redacted error text.
- Backend console log: `.task-tmp/human-rehearsal-backend.log`. It records normal
  server console output, not a complete provider/WebRTC trace; lack of errors is
  not proof that speech succeeded. Existing teacher logs retain received transcripts.

No runtime changes should be made unless a failure is reproducible. A missing test
remains **UNVERIFIED**; only an actually observed failure gets **FAIL**.

Send the following completed observations to continue verification:

```text
Person performed test: yes/no; browser + microphone/output device:
Saved human recording: heard own voice / silent / untested:
Saved replay after refresh: pass/fail/untested:
Visual transition: noted cue time ___; aligned / misaligned / untested:
GPT-Live first spoken question: recognized? ___; heard relevant answer? ___
GPT-Live spoken follow-up in same session: recognized? ___; heard relevant answer? ___
End session: microphone indicator stopped? ___
Return to recorded lesson: paused at ___; resumed there with correct visual? ___
Actual errors + reproduction steps + relevant redacted logs:
```

Readiness can become **PASS for the tested human demo/device** only after real
capture, audible saved speech, aligned visuals, two audible spoken GPT-Live turns,
microphone shutdown and correct lesson resume are confirmed. This does not verify
untested devices, real classroom children or learning gains.
