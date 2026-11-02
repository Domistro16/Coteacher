# Coteacher

Built by **Esih Egwurube** for the **Andela × OpenAI Hackathon**.

Another chance at the classroom lesson. A working sprint proof of concept with
one light/refraction lesson, two simulated learners, a safe activity, offline
study, and teacher insights. No real children's data. Prepared offline learning
uses local content; explicitly enabled connected tutoring uses paid OpenAI APIs.

The student learning extension adds age-first consent-ready onboarding, private
editable preferences, individual offline memory across reviewed lesson mappings,
and teacher-reviewed reusable support. Two fictional learners and a bounded
follow-on refraction lesson exercise the full journey. See
[student learning acceptance](docs/student-learning-acceptance.md) and
[operations and limits](docs/student-learning-operations.md). The evaluated local
model remains disabled; real-child rollout remains deferred.

## Run the account apps

Use Node.js 22.12 or later. On Windows PowerShell use `npm.cmd` instead of `npm`.
Run each service in a separate terminal:

For built app previews in one terminal, run `npm run build` followed by
`npm run local:start`. This serves the backend and all three account apps on the
loopback URLs below, using the gitignored local provider settings. Ctrl+C stops
all four servers. This is local fictional-data verification, not public hosting.

```sh
npm install
npm run delivery:start
npm run dev:school
npm run dev:teacher
npm run dev:student
```

School: http://127.0.0.1:5175; teacher: http://127.0.0.1:5174;
student: http://127.0.0.1:5173. Each app has its own entry point; school access
uses the school app root. Local accounts and data are fictional acceptance data.
Schools register for review, configure classes and subjects, affiliate teachers
and place students before school lessons become available. See
[school registration](docs/school-registration.md) for the complete journey and
[deployment setup](docs/school-deployment.md) for Supabase, R2, Render and the
three Vercel projects. Current PC-hosted verification uses Supabase and R2;
Render and Vercel deployment testing is deferred.
See [acceptance evidence](docs/school-acceptance.md) for tested journeys and the
remaining live-service checks.

`npm run build` builds all three account apps. Production previews support
saved offline student study; development mode is for interface work.

## Run the original two-profile demo

The independent sprint demo remains available explicitly:

```sh
npm run delivery:start
npm run dev:demo:student
npm run dev:demo:teacher
```

For offline demo verification, build in demo mode before starting previews:

```sh
npm run build:demo
npm run preview --workspace @coteacher/student -- --host 127.0.0.1 --port 4173 --strictPort
npm exec --workspace @coteacher/teacher -- vite preview --host 127.0.0.1 --port 4174 --strictPort
```

Run the delivery and app commands in separate terminals. In the teacher app,
prepare and approve the reviewed materials, start **Teach / projector**, grant
microphone permission and record while advancing visuals manually. Stop, replay
and approve the recording, then review and approve both personalized visual
sequences. Open **Recording review** to select Default, Student A or Student B without changing the audio or playback time. Then open **Publish packages** and **Publish recorded lesson**.

Student A's demo PIN is `111111`; Student B's is `222222`. Unlock a profile and
land on their personal home. Published recordings appear as lesson cards fetched
from the configured service; **Watch Now** opens the dedicated player with that
learner's synchronized visuals. Press **Download for offline use** and wait
for download completion and **Ready offline** before disconnecting. Streaming
alone does not save the audio for offline use. Pause for an explanation, activity
or check using **I don’t understand**, then return to the original recording. Positions, activities, quizzes
and questions are encrypted in IndexedDB and survive offline reopening.

The real delivery service listens on `127.0.0.1:8787`, persists one published
demo in `.coteacher-delivery`, and is proxied by both dev and preview apps.
It starts empty: a teacher must publish their actual reviewed microphone
recording. No cloud storage or public media hosting is configured. See
[recorded delivery verification](docs/recorded-delivery-verification.md) for
configuration, storage/privacy limits and the tested complete journey.
The teacher workspace now opens on a dashboard and separates lesson creation,
recording, review, publication, insights, questions and **Sync & Transfers**.
Connected recorded learners automatically return encrypted event snapshots to
the configured school service; a validated acknowledgement confirms receipt.
Prepared returned answers merge into the correct learner without replacing local
work. Failed sync keeps the complete local ledger. Complete encrypted teacher
file exports remain an alternative offline transfer. See
[teacher workspace verification](docs/teacher-redesign-verification.md).
School transfer and returned-answer tools are under **Profile → School & device**.
The older notes-only fixture is inside **Transfer lesson from school → Prepared-content
compatibility demo**; existing notes-only records open through **Open saved prepared-content
lesson**. Their questions and progress remain available. Home, My Lessons,
Downloads, Progress and Profile use desktop sidebar/mobile bottom navigation.
See [student redesign verification](docs/student-redesign-verification.md).

## Verify

```sh
npm test
npm run pipeline -- --lesson fixtures/demo-lesson
npm run test:e2e:school
npm run test:e2e
```

On first setup, install Chromium with `npx playwright install --only-shell chromium`.
Browser tests build their corresponding app mode and use in-process local preview servers on ports
4273/4274/4275, avoiding Windows child-server cleanup. Run checks sequentially on
memory-constrained hosts.

The CLI also generates encrypted demo packages after a review acknowledgement:

```sh
npm run pipeline -- --generate --notes fixtures/demo-lesson/teacher-notes.md --activity fixtures/demo-lesson/activity-notes.md --out test-results/generated --approve-reviewed
```

Use a new output directory on each run; existing files are never overwritten.
Review the supplied sources and lesson fixture before using `--approve-reviewed`.

## Prepared help narration

While exploring a paused concept, press **Enable narration** once.
New explanations, answers, no-match replies, quiz feedback and Try it instructions
then play automatically. Captions and source references stay visible. Use Play,
Pause, Replay and Speech speed controls; a new response replaces obsolete speech.
Locking the profile stops playback, and each unlock starts with narration off.

The fixed demo ships 40 compressed MP3 clips (about 1.3 MB) in the PWA shell,
including the supported returned answer. A generic Microsoft Zira system narrator
is used for prepared help, without imitation or voice cloning. These clips are
separate from the captured teacher audio in the main lesson player. They work
offline without an installed device voice. New text without a clip uses only an
available **local** English browser synthesis voice. If that is unavailable,
the app states the limitation and retains captions. Browser autoplay may require
pressing Play; it is never reported as successful when blocked.

Clip preparation is an optional offline pipeline command, requiring Windows SAPI
and an already installed FFmpeg. Normal builds use the checked-in clips and need
neither tool. Regenerate after changing reviewed text:

```powershell
New-Item -ItemType Directory -Path .task-tmp -Force | Out-Null
$env:TEMP = Join-Path (Get-Location) '.task-tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $env:TEMP 'npm-cache'
npm.cmd run generate:audio
```

Generation intermediates, npm logs/cache and test temporary files can therefore
stay on the workspace drive. Clip paths use the existing `audioAssetPath`
contract; the fixed-answer/caption manifest is internal to this single-lesson
app. This does not introduce a general multimedia package-transfer format.

Command intents are pause, replay, explain differently, try it, quiz me and repeat.
For example, “put it another way”, “start the experiment” and “check my
understanding” work, with bounded correction of small command-word typos.
“Pause here” requests another explanation; “pause audio” pauses speech.
Other words go intact to the current-step matcher. Unsupported input gets an
honest no-match, is saved, and offers an unseen sourced explanation as related
material. It is never presented as an answer to an unsupported question.

## Boundaries

- Generation is a labelled local simulation limited to the two supplied reviewed
  Markdown/text sources. Unsupported uploads are rejected.
- Offline answers come from a conservative local matcher. Unsupported questions
  stay queued. The teacher's answer-return simulation supports exactly
  “Should I use a glass cup for this activity?”; its answer cites activity notes.
- Shared devices have separate PIN-protected profiles. Transfers are encrypted
  JSON files; the local recording service supports publication, streaming and
  explicit downloads. Progress and questions also synchronize through the configured
  local school service after its acknowledgement; manual files remain a fallback.
  Public cloud sync is not configured. Demo PINs are public fixtures,
  so this is not production-grade identity or security.
  Offline cross-profile question/quiz/activity isolation, wrong PINs and exact
  resume are covered in [shared-device verification](docs/shared-device-verification.md).
- Teacher received snapshots now persist encrypted on the teacher browser and
  in the local school service when returned directly. Seeded aggregates,
  histories, personalization, and answer return are visibly simulated.
- Offline voice input requires an already available local recognizer; typing always
  works. Opt-in connected voice uses GPT-Live and sends microphone audio to OpenAI.
  Connected text answers require explicit consent too. The single floating avatar
  listens first and preserves the teacher recording's paused position.
- Teacher presentation supports explicit microphone recording with pause/mute,
  sample-timed visual cues, saved private review drafts and separate media approval.
  Reviewed recordings play with matching visuals in offline personal packages.
  Two simulated histories select genuinely different source-linked SVG scenes.
  Both visual sequences require teacher review, share locally stored compressed
  audio, and preserve separate resume positions. The two-minute cap is removed;
  media is limited to 20 MB. See [personalized replay verification](docs/personalized-replay-verification.md).
- Recorded playback now explains history/preference/default visual choices and
  offers sourced alternate representations and concept checks while paused.
  Help choices, exact audio position and separate learner histories restore offline.
  See [visual adaptation verification](docs/visual-adaptation-verification.md) for
  the implemented rules, demonstration and remaining simulation limits.
- No physical low-end Android device was available for verification. Mobile
  Chromium checks are automated; hardware installation, performance, and local
  speech availability require a device check.
- The approved refraction Try it now opens its exact concept check on completion.
  Wrong answers, retries and selected choices persist independently offline;
  completion is shown as a self-report, not demonstrated understanding.
  See [activity and check verification](docs/activity-check-verification.md).

Follow [the demo script](docs/demo-acceptance.md) and
[phase status](docs/sprint-status.md). Repository rules start in `AGENTS.md`;
schemas and shared validators remain the source of truth.

See the [2026-10-10 safety and usability audit](docs/sprint-safety-audit.md) for
reviewed-content safeguards, mobile/offline verification, privacy and PIN limits,
and remaining deployment blockers. This simulated demo is not production security.
