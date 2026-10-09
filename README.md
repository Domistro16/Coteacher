# Coteacher

Another chance at the classroom lesson. A working sprint proof of concept with
one light/refraction lesson, two simulated learners, a safe activity, offline
study, and teacher insights. No paid services or real children's data.

## Run it

Use Node.js 22.12 or later. On Windows PowerShell use `npm.cmd` instead of `npm`.

```sh
npm install
npm run dev:student
npm run dev:teacher
```

Student: http://127.0.0.1:5173 · Teacher: http://127.0.0.1:5174.
Development mode supports interaction previews; use a production build to test
offline reopening and PWA collection:

```sh
npm run build
npm run preview --workspace @coteacher/student -- --host 127.0.0.1 --port 4173 --strictPort
npm run preview --workspace @coteacher/teacher -- --host 127.0.0.1 --port 4174 --strictPort
```

Run the preview commands in separate terminals. Student A's demo PIN is `111111`;
Student B's is `222222`. Select a profile, unlock, collect the demo lesson or
import the teacher's encrypted file, and wait for **Ready offline** before
disconnecting. Lesson position, activity instructions, quizzes, and questions
are encrypted in IndexedDB and survive offline reopening.

## Verify

```sh
npm test
npm run pipeline -- --lesson fixtures/demo-lesson
npm run test:e2e
```

On first setup, install Chromium with `npx playwright install --only-shell chromium`.
Browser tests build both apps and use in-process local preview servers on ports
4273/4274, avoiding Windows child-server cleanup. Run checks sequentially on
memory-constrained hosts.

The CLI also generates encrypted demo packages after a review acknowledgement:

```sh
npm run pipeline -- --generate --notes fixtures/demo-lesson/teacher-notes.md --activity fixtures/demo-lesson/activity-notes.md --out test-results/generated --approve-reviewed
```

Use a new output directory on each run; existing files are never overwritten.
Review the supplied sources and lesson fixture before using `--approve-reviewed`.

## Spoken lesson

After unlocking and collecting a lesson, press **Enable narration** once.
New explanations, answers, no-match replies, quiz feedback and Try it instructions
then play automatically. Captions and source references stay visible. Use Play,
Pause, Replay and Speech speed controls; a new response replaces obsolete speech.
Locking the profile stops playback, and each unlock starts with narration off.

The fixed demo ships 40 compressed MP3 clips (about 1.3 MB) in the PWA shell,
including the supported returned answer. A generic Microsoft Zira system narrator
is used, without teacher recordings, imitation or voice cloning. The clips work
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
  JSON files; no backend or automatic sync exists. Demo PINs are public fixtures,
  so this is not production-grade identity or security.
- Teacher imports stay in memory for the current session. Seeded aggregates,
  histories, personalization, and answer return are visibly simulated.
- Voice input requires an already available local recognizer. Otherwise typing works.
  No speech-model downloads, network recognition, or audio recording storage.
- No physical low-end Android device was available for verification. Mobile
  Chromium checks are automated; hardware installation, performance, and local
  speech availability require a device check.

Follow [the demo script](docs/demo-acceptance.md) and
[phase status](docs/sprint-status.md). Repository rules start in `AGENTS.md`;
schemas and shared validators remain the source of truth.
