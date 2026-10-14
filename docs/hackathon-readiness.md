# Hackathon readiness verification — 14 October 2026

Later operator rehearsal update: **PARTIAL** overall. The operator confirmed
teacher recording/visual timing, relevant audible live question/follow-up turns,
spoken acceptance opening the question-grounded personalized quiz with audio,
microphone shutdown and saved-position resume. A newly generated saved-answer
voice check remains unperformed: the operator reported its playback button absent
and deprioritized investigation. Physical offline rehearsal on the demo device
has not been confirmed. See human-audio-rehearsal.md and its evidence JSON for
the current status; the assessment below records the earlier automated run.

Final commit validation: `npm.cmd test` **PASS**, including current generated
contracts, TypeScript and all **445 tests across 27 files** in one full run.
`npm.cmd run build` **PASS** for both applications, with existing bundle-size
advisories. These checks do not change the remaining human verification status.

**Human-demo readiness: UNVERIFIED.** The essential human microphone
rehearsal remains unverified. Automated teacher capture uses synthetic audio, not a
verified teacher speaking. This report distinguishes working software from that gap.
No application features or interfaces were changed during this verification.

## Eleven-step assessment

UNVERIFIED below means the required human proof is missing; no physical microphone
failure has been established. PASS applies to the actual desktop Chromium software path
with fictional profiles and the disclosed automated input.

| # | Required step | Result | Evidence |
|---|---|---|---|
| 1 | Teacher prepares and approves | PASS | Actual preparation UI loads reviewed fixture sources, generates the labelled simulated draft and separately approves it. |
| 2 | Teacher records synchronized audio/visuals | UNVERIFIED — human input | Native microphone/AudioWorklet/Opus capture, timed cues, saved review, playback and separate approvals work with Chromium synthetic input. A human recording and its timing/privacy review are still required. |
| 3 | Two personalized packages available | PASS | Teacher publishes A/B packages containing the same recording and objective with different approved visual sequences. |
| 4 | Student watches recorded lesson | PASS | Actual native streamed recording plays with concept visuals. |
| 5 | Student interrupts Coteacher | PASS | One floating avatar, listen-first activation, native teacher audio paused at the saved timestamp; player dimensions preserved. |
| 6 | AI explains and handles follow-up | PASS | Real GPT-Live session and two source-checked OpenAI Responses turns; contextual follow-up remains in the same session. Decoded live speech is verified, not physical speaker hearing. |
| 7 | Student completes quick check | PASS | Approved refraction check saves selected option, result and sources; self-confirmation is distinct from quiz evidence. |
| 8 | Evidence updates memory | PASS | A's two incorrect checks recommend the pencil diagram; B's deliberate choice recommends ordered ray steps. Recommendations cite actual event IDs and survive restart. |
| 9 | Download and watch offline | PASS | Complete media download, offline closed-page reopening, PIN unlock and advancing local Blob audio. Streaming alone does not count. |
| 10 | Offline questions persist/synchronize | PASS | Exact question/context survives reopening; reconnect returns a sourced real AI answer and school receipt. Repeated ledger submission produces no duplicate events/questions. |
| 11 | Teacher sees insights | PASS | Actual Class insights receives two snapshots, incorrect checks and question context; a sourced refraction teaching nudge appears. Seeded 18-learner statistics remain separate. |

The automated acceptance lesson is `light-and-refraction`, recording
`recording-d0abebc1-1d47-4cf6-8797-788ac88d2e0e`. The live probe uses a copy of the
same just-approved recording from `.task-tmp/adaptive-learning-PuqY53`; isolated
school records prevent overwriting the existing publication. These are complementary
browser runs on that lesson, not a claim that one uninterrupted human rehearsal ran.

## Test evidence

- `npm.cmd test`: generated contracts and TypeScript passed; 435 tests passed and
  one delivery assertion failed because it expected the submitted `exportedAt`
  unchanged. The school now retains a monotonic received-snapshot timestamp.
- Corrected only the stale delivery assertions to preserve complete event/question
  equality and check monotonic timestamps. `npm.cmd exec -- vitest run
  tests/delivery.test.ts`: **9/9 PASS**. Together these runs verify all 436 distinct
  unit cases; no final single clean full-suite run is claimed. The previously
  timed-out outage/citation/hazard test passed in the full run (36.5 seconds).
- `npm.cmd run build`: **PASS**, both production applications.
- `npm.cmd run pipeline -- --lesson fixtures/demo-lesson`: **PASS**, valid simulated
  `light-and-refraction` package.
- `npm.cmd run verify:adaptive:live`: **PASS**, all ten flags, 10:30:45–10:32:11 UTC.
  Actual UI actions produced 17 A events and 12 B events. Real Responses HTTP 200:
  `req_1114c96047a744bb8b881c5dc198e907`; real cached speech HTTP 200:
  `req_e2ff5178a1b640ab9e063be5ba534364`.
- `npm.cmd run verify:tutoring:live` with that same approved recording: **PASS**,
  all ten flags, 10:32:37–10:35:01 UTC. Actual GPT-Live session HTTP 201; first
  Responses HTTP 200 `req_3af2a10ed7d44771aa57d24d79e742df`; contextual follow-up
  HTTP 200 `req_b9fe68813fce436e9519c3f3462cbdb7`; offline queued response HTTP 200
  `req_e41f617caf7e4e77aa8fc09372b51dd0`. All three speech requests returned 200.
  Pause/resume was checked at 1.35515 seconds in this short synthetic recording.
- Final `npm.cmd run typecheck`: **PASS** after the test-only correction.
- `npm.cmd exec -- playwright test tests/e2e/opus.spec.ts tests/e2e/recording.spec.ts
  --grep "streaming native Opus|native Opus preserves|microphone permission failure|canceling a pending permission request"
  --reporter=line`: **4/4 PASS**, 38.3 seconds. Actual native encode/decode/seek
  exceeds two minutes and preserves arbitrary stop boundaries; permission failure
  and late permission cancellation release capture safely. Audio input is synthetic.
- Current received-teacher and mobile-avatar screenshots were visually inspected.
  Full Playwright regression was not rerun; these four native cases and both real
  acceptance probes are the browser scope. README's nonexistent teacher preview
  command was corrected to direct Vite invocation, verified with the workspace CLI.

Raw evidence: [adaptive run](adaptive-learning-evidence.json),
[live tutoring run](tutoring-journey-live-evidence.json).
Teacher screenshot: [received interactions](screenshots/adaptive-teacher-received.png).

## Exact reproduction on the demo laptop

Use Node 22.12+ and current Chrome/Edge on this laptop. Use one fresh, persistent
browser profile; do not use a private window whose storage disappears on closing.
Use one student tab and lock before switching profiles. Keep the same origins below
through download, offline reopening and reconnect.

From PowerShell in `D:\Coteacher`:

```powershell
npm.cmd install
npm.cmd exec -- playwright install --only-shell chromium
npm.cmd run build
```

Configure the existing root `.env.local` with server-only `OPENAI_API_KEY` and
models from `.env.example`. If no env file exists, copy the example first; do not
overwrite an existing configured key. Connected live AI requires internet and
API access; keys never belong in a `VITE_` variable.

Run each command in a separate terminal, from `D:\Coteacher`:

```powershell
# Terminal 1: existing local backend; dedicated demo folder preserves other records.
$env:COTEACHER_DELIVERY_DIR = 'D:\Coteacher\.task-tmp\hackathon-demo'
npm.cmd run delivery:start

# Terminal 2: production student PWA (offline support requires this build).
npm.cmd run preview --workspace @coteacher/student -- --host 127.0.0.1 --port 4173 --strictPort

# Terminal 3: teacher package has no npm preview script; invoke Vite directly.
npm.cmd exec --workspace @coteacher/teacher -- vite preview --host 127.0.0.1 --port 4174 --strictPort
```

1. Open teacher `http://127.0.0.1:4174`. Prepare lesson → Teaching materials →
   **Use reviewed demo materials** → **Generate simulated lesson**. Review sources,
   explanations, checks and safe activity; acknowledge review → **Approve lesson**.
   This is deterministic prepared generation, not real AI lesson authoring.
2. **Teach / projector** → **Start presentation**. Check microphone access and allow
   it. Enable **Record my explanation only** → **Start audio recording**. A human
   should speak a short light/refraction explanation and advance **Next visual**
   at the matching words. Stop/save, replay/seek and listen; verify visual timing
   and privacy. A successful permission dialog alone is insufficient proof.
3. Acknowledge audio/timing review → **Approve recording for learners**. Review
   Default/A/B playback with the same narration, acknowledge both visual sequences →
   **Approve personalized playback**. **Publish packages** → **Publish recorded
   lesson**. Keep this one recording for both learners throughout.
4. Open student `http://127.0.0.1:4173`. A: PIN `111111`; B: `222222`. Unlock A →
   **Watch Now** → refraction chapter → play → **Talk with Coteacher**. Explicitly
   enable connected tutoring, wait for availability, **Start live conversation**,
   allow microphone, then ask: “How can a lens in eyeglasses bend light, and how
   does that connect to this water lesson?” Wait for the spoken sourced answer.
   Follow up: “How is that connected to the change of material you mentioned?”
   Compact typed follow-up is valid in the same live conversation. If voice fails,
   **Type instead** / **Use connected AI answers** is genuine connected text AI,
   but must be labelled as that fallback, not GPT-Live.
5. **It makes sense now** → quick check, or **Check this concept**. For deliberate
   demo evidence give A two incorrect attempts with a retry; do not call this a
   real child's struggle. **Approved alternatives** shows the event-backed pencil
   recommendation. Return to the recording and verify its saved position resumes.
6. Download A with **Download for offline use**; wait for **Ready offline** and
   **Saved on this device**. Lock/switch to B, answer the refraction check correctly,
   then choose **Follow the ray across the boundary step by step** under Approved
   alternatives. Show B's evidence-backed recommendation and independent history;
   download B and wait for readiness. Initial assigned routes are simulated.
7. Reopen A, disable network using browser DevTools Offline (leave localhost apps
   running), close/reopen the student tab at the same URL and unlock. Play local
   audio. Type “Why does the pencil look broken?” for prepared sourced help. Then
   type “How does a telescope lens use the same bending of light as this water
   lesson?” for an unsupported offline question. Reopen again and show it persisted.
   Do not claim offline GPT-Live or offline speech recognition.
8. Restore network. Wait for the AI reply and the receipt-backed school sync status;
   A must have opted in before going offline. Teacher **Class insights** → **Refresh
   school records** → **Learning records: Received demo interactions**. Show two
   received learners, concept evidence, exact question and the sourced teaching
   recommendation. Repeated refresh/sync must not inflate counts. Switch separately
   to Simulated class to identify its 18 learners / 4 support signals.

AI-generated answers are unreviewed teacher-oversight content. An AI reply does not
automatically clear the separate teacher-guidance queue or become approved package
content. Public demo PINs and localhost delivery are proof-of-concept facilities.

To reproduce automated evidence from the repository root:

```powershell
npm.cmd run verify:adaptive:live
$demoEvidence = Get-Content docs/adaptive-learning-evidence.json -Raw | ConvertFrom-Json
if ($demoEvidence.result -ne 'PASS') { throw 'Adaptive verification did not pass' }
$demoFolder = Get-ChildItem .task-tmp -Directory -Filter adaptive-learning-* | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$env:COTEACHER_DELIVERY_DIR = $demoFolder.FullName
npm.cmd run verify:tutoring:live
```

These invoke real, billable configured OpenAI
services but use synthetic microphone input. The live probe needs a nonempty Windows
SAPI speech fixture or the earlier valid `.task-tmp/avatar-test-question.wav`; it
fails honestly if speech generation is unavailable.

## Truthful three-minute presentation

Before the timed presentation, complete human recording/review, microphone/speaker
rehearsal and publication above; download both packages. Keep teacher and student
tabs open, A at refraction, and source/review screens ready. This preparation is
disclosed, not presented as work done in three minutes. Rehearse provider latency;
do not invent a response or skip a failed stage to meet the clock.

| Time | Show and say |
|---|---|
| 0:00–0:25 | Teacher source/approval and recording review: “This is one lesson I reviewed and recorded earlier. Both fictional learners get the same objective and voice; these starting visual routes are simulated.” Replay a few synchronized seconds. |
| 0:25–1:10 | A interrupts; audio pauses and avatar listens. Ask the eyeglasses question, receive real live speech and ask the follow-up. “This connected answer uses OpenAI and identifiable approved/curated sources.” |
| 1:10–1:45 | A completes/retries a check; show its event-backed help. Lock/switch to B, answer correctly and select ordered rays. “These recommendations follow the actions we just took, not a fixed learning-style label.” Resume the original recording. |
| 1:45–2:20 | Show downloaded readiness, disconnect/reopen A and play local audio. Type the unsupported telescope question and show it saved. “Offline help is prepared; new questions wait locally.” |
| 2:20–2:40 | Reconnect and wait for sourced AI resolution and school acknowledgement. “Receipt confirms transfer; repeated sync preserves event IDs.” |
| 2:40–3:00 | Teacher refreshes Received demo interactions, shows A/B evidence and safe refraction nudge. “The separate 18-learner view is seeded simulation. This is observed demo evidence, not measured learning gains.” |

If the human rehearsal is not completed, announce “synthetic-audio pipeline demo”
at the beginning. Do not describe the automated microphone fixture as the teacher's
voice or declare the complete intended experience READY.
