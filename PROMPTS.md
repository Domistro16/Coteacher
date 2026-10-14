# Chat prompts

User-authored messages from this chat, preserved in chronological order. Repeated prompts and implementation approvals are retained. The first entry records the repository instructions as originally supplied, rather than the subsequently updated AGENTS.md. Clarification selections are recorded separately below.

## 1. Initial repository instructions

````text
# AGENTS.md instructions for D:\coteacher

<INSTRUCTIONS>
# AGENTS.md: Coteacher

Coteacher turns a classroom lesson into something a student can go back into. A teacher uploads notes and sources; AI builds a lesson package; each student studies their own version offline in a PWA; confusion data flows back to the teacher. This repo is a **sprint proof of concept**, not production software.

## Non-negotiables (details in `docs/safety-and-data.md`)

1. The student app works offline after the package is loaded. No network call on the student core path.
2. Every explanation, answer, quiz item and "Try it" activity carries `sourceRefs`. No content without a source.
3. The question matcher returns a match above the threshold or an honest no-match. Never force a low-confidence match.
4. "Try it" activities use safe household items only.
5. Personalization changes the route, never the learning objective.
6. Seeded data is labelled `"simulated": true`. No real children's data anywhere.

## Read the right doc before you start

- Schemas are the contract: `/schemas`. Change a schema first, then types, then code.
- Stack, folders, working rules: `docs/architecture.md`
- What to build, seed, or only describe: `docs/scope.md`
- Question matcher spec: `docs/matcher.md`
- The demo script that must always pass: `docs/demo-acceptance.md`
- Safety, privacy and data rules: `docs/safety-and-data.md`

## How to work

- Small vertical tasks, each with acceptance criteria and tests. Do not start a task without one.
- Simple and reliable beats clever. Keep packages small (compressed audio, SVG/CSS visuals, no video).
- Anything marked "described only" in `docs/scope.md` gets a stub behind a named interface. Do not build it.
- If a change breaks the demo acceptance test, fix it before moving on.
- If you make the same mistake twice, say so and propose an update to this file.

## Commands (fill in once scaffolded)

- Install: `npm install`
- Dev: `npm run dev`
- Unit tests: `npm test`
- End-to-end tests: `npm run test:e2e`
- Generate demo package: `npm run pipeline -- --lesson fixtures/demo-lesson`

</INSTRUCTIONS>
````

## 2. Schema contract task

````text
Goal: create the two JSON schemas for Coteacher (lesson package and progress record) and make them the working contract for the repo.
Context: read AGENTS.md, docs/architecture.md, docs/scope.md, docs/safety-and-data.md, and docs/schema-requirements.md.
Constraints: JSON Schema draft 2020-12; additionalProperties false; schemaVersion on both; no network calls; fake data only; do not build anything listed as "described only" in docs/scope.md.
Done when: both schemas exist in /schemas; types are generated from them into /packages/shared; the referential-integrity checks from docs/schema-requirements.md are implemented; a hand-written demo lesson fixture (a light-and-refraction lesson with one safe Try it) passes everything; each invalid fixture listed in the requirements fails for the right reason; and `npm test` passes.
Ask me clarifying questions first, then show the plan for approval before you write any code.
````

## 3. Schema implementation approval

````text
Implement the plan.
````

## 4. Repository scaffold task

````text
Goal: scaffold the Coteacher repo and make the lesson package schema the working contract.
Context: read AGENTS.md, docs/architecture.md, docs/scope.md, and the files in /schemas.
Constraints: no network calls in the student app; do not build anything listed as "described only" in docs/scope.md; use fake data only.
Done when: the folder structure from docs/architecture.md exists, types are generated from the schemas, a hand-written demo lesson fixture validates against the lesson package schema, and `npm test` passes.
Ask me clarifying questions first and show the plan for approval before you write any code.
````

## 5. Scaffold implementation approval

````text
Implement the plan.
````

## 6. Student player task — interrupted turn

````text
Goal: build the student lesson player in /apps/student, driven only by the demo fixture.
Context: read AGENTS.md, docs/architecture.md, docs/scope.md, docs/demo-acceptance.md, and the schemas in /schemas.
Constraints: no network calls; tap-to-advance timeline; variant switching with the student able to return to the teacher's original at any time; push-to-talk and typing input can be stubbed for now; mobile-first layout for a low-end Android phone.
Done when: the player loads the fixture, steps through the timeline, switches variants, runs the Try it and returns to the teacher's original step, and a Playwright test covers that path.
Ask clarifying questions first, then show the plan for approval before writing code.
````

## 7. Student player task — repeated after interruption

````text
Goal: build the student lesson player in /apps/student, driven only by the demo fixture.
Context: read AGENTS.md, docs/architecture.md, docs/scope.md, docs/demo-acceptance.md, and the schemas in /schemas.
Constraints: no network calls; tap-to-advance timeline; variant switching with the student able to return to the teacher's original at any time; push-to-talk and typing input can be stubbed for now; mobile-first layout for a low-end Android phone.
Done when: the player loads the fixture, steps through the timeline, switches variants, runs the Try it and returns to the teacher's original step, and a Playwright test covers that path.
Ask clarifying questions first, then show the plan for approval before writing code.
````

## 8. Player implementation approval

````text
Implement the plan.
````

## 9. Save chat prompts

````text
Save all prompts used in this chat in a PROMPTS.md file
````

## 10. Prompt log implementation approval

````text
Implement the plan.
````

## Clarification selections

| Task | Question | Selected answer |
| --- | --- | --- |
| Schema contract | What student ID format should the schemas enforce to reject real-looking names? | Opaque prefixed IDs (Recommended) |
| Schema contract | Should simulated be a general boolean in the contract or be restricted to true for this proof of concept? | Boolean; fixtures true (Recommended) |
| Schema contract | How should validation handle IDs and sources referenced by a progress record? | Validate with lesson (Recommended) |
| Schema contract | Does “no network calls” also prohibit downloading development dependencies during setup? | Offline runtime and tests (Recommended) |
| Repository scaffold | What should the student and teacher app scaffolds contain? | Runnable shells (Recommended) |
| Repository scaffold | How should the pipeline scaffold make the shared lesson contract concrete? | Validation CLI (Recommended) |
| Repository scaffold | Should this task configure and run browser tests? | Reserve the folder (Recommended) |
| Student player | Should this player work offline only after it opens, or also survive an offline reload? | After initial load (Recommended) |
| Student player | How should students work through the Try it activity? | Guided steps (Recommended) |
| Student player | How should this first player use the fixture’s personalized route? | Timeline with choices (Recommended) |

## 11. Repository instructions supplied for this session

# AGENTS.md: Coteacher

Coteacher turns a classroom lesson into something a student can go back into. A teacher uploads notes and sources; AI builds a lesson package; each student studies their own version offline in a PWA; confusion data flows back to the teacher. This repo is a **sprint proof of concept**, not production software.

## Non-negotiables (details in `docs/safety-and-data.md`)

1. The student app works offline after the package is loaded. No network call on the student core path.
2. Every explanation, answer, quiz item and "Try it" activity carries `sourceRefs`. No content without a source.
3. The question matcher returns a match above the threshold or an honest no-match. Never force a low-confidence match.
4. "Try it" activities use safe household items only.
5. Personalization changes the route, never the learning objective.
6. Seeded data is labelled `"simulated": true`. No real children's data anywhere.

## Read the right doc before you start
- At the start of any new task, read docs/product-brief.md for product context
- Schemas are the contract: `/schemas`. Change a schema first, then types, then code.
- Stack, folders, working rules: `docs/architecture.md`
- What to build, seed, or only describe: `docs/scope.md`
- Question matcher spec: `docs/matcher.md`
- The demo script that must always pass: `docs/demo-acceptance.md`
- Safety, privacy and data rules: `docs/safety-and-data.md`

## How to work

- Small vertical tasks, each with acceptance criteria and tests. Do not start a task without one.
- Simple and reliable beats clever. Keep packages small (compressed audio, SVG/CSS visuals, no video).
- Anything marked "described only" in `docs/scope.md` gets a stub behind a named interface. Do not build it.
- If a change breaks the demo acceptance test, fix it before moving on.
- If you make the same mistake twice, say so and propose an update to this file.
- Save all prompts used in each session in the PROMPTS.md file
## Commands

- Install: `npm install`
- Student player: `npm run dev` or `npm run dev:student`
- Teacher dev shell: `npm run dev:teacher`
- Build both apps: `npm run build`
- Generate contract types: `npm run generate:types`
- Check generated types: `npm run check:types`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Validate demo package: `npm run pipeline -- --lesson fixtures/demo-lesson`
- Student player browser tests: `npm run test:e2e`; see `tests/e2e/README.md`.

The pipeline command currently validates hand-written packages; lesson generation
and the full application demo remain future work.

Contract workflow and validation APIs: `docs/contracts.md`. On Windows PowerShell
with script execution disabled, use `npm.cmd` in place of `npm`.


## 12. Full sprint planning request

Goal: The goal is to create a working sprint based on the product brief. Create a proper plan for this session breaking down the implementation of the work into phases that can be worked on individually. Because this is a sprint doesn't mean creativity will be discarded. UI/UX have to be just as described in the product brief. External costs should be reduced to the bare minimum and simulations should be used if external costs are demanded like in areas where external llm calls are required.

Context: Go through docs/product-brief.md and review AGENTS.md file.

Constraints: Do not go beyond building a working proof of concept. If something doesn't work let me know

Done when: Complete proof-of-concept with all phases built completed

Planning selections: one lesson with explicit generation limits; warm classroom design; encrypted personal exports; simulated automatic queued answer; typing fallback when local speech is unavailable.

## 13. Full sprint implementation

Implement the plan.




## 14. Product brief demo verification

Please verify how closely it matches the product-brief for a demo


## 15. Online demo behavior verification

It's not just the offline loop that we need to implement. Does it work as it is intended online as well? Naturally the online performance should me much smoother than the offline performance


## 16. Consolidated demo gaps

What are the gaps then

## 17. Natural help and explanation history planning

/plan
Goal: make natural help requests and "explain differently" work in the student player.
Context: read AGENTS.md, docs/product-brief.md, docs/matcher.md, docs/demo-acceptance.md, and the current explain and matcher flow.
Constraints: offline, no network; rule-based intent detection that runs before the matcher; no new dependencies; propose any schema change before making it.
Done when:
(1) These all trigger "explain differently at the current step": "Pause here. I understand this part, but I don't understand this", "I'm lost", "explain that again", "I didn't get that", "can you say it differently", "this part is confusing". Any confusion text after "but I don't understand" is passed to the matcher as extra context.
(2) Unrelated or off-topic questions still go to the matcher or the honest no-match. Tests include near-misses that must NOT trigger the help intent.
(3) Each explain-again request shows a variant not yet shown to that student at that step, rotating through the available variants. When all are exhausted, say so honestly and offer the Try it or typing a question.
(4) The history is kept per student profile, so Student B does not inherit Student A's.
(5) Unit tests and the Playwright demo path are updated, and npm test and the e2e tests pass.
Ask clarifying questions first, then show the plan for approval before writing code.

Clarification selected: All unseen text explanations in the learner's route order,
including an unseen teacher original or refresher; offer Try it separately.

## 18. Planning clarification confirmation

Still in plan mode to answer your earlier question in this image C:\Users\USER\OneDrive\Pictures\Screenshots\Screenshot 2026-10-08 153045.png

I chose option 1

Confirmed from the screenshot: unmatched specific confusion should show honest
no-match and automatically queue the suffix; generic "this/that/this part" stays
help without queuing a meaningless question. Displayed variants count as seen
and history persists across navigation and reopening. The plan reuses existing
progress events and proposes no schema or dependency changes.

## 19. Implement approved help plan

Implement the plan.

## 20. Spoken replies and unscripted intent planning

/plan
Goal: make Coteacher speak back and remove scripted-phrase dependence from intent handling.
Context: read AGENTS.md, docs/product-brief.md, docs/voice.md, docs/matcher.md, and the current player and intent code.
Constraints: offline; no new paid services; captions always shown; do not clone or imitate the teacher's voice; propose any schema change before making it.
Done when:
(1) Every explanation, matched answer, no-match message and quiz feedback is spoken, with captions and play/pause/replay controls. Propose the audio approach per docs/voice.md (pre-generated files if feasible, otherwise speech synthesis) and tell me the tradeoff before building.
(2) Intent handling follows docs/voice.md: a small set of command intents, and everything else at a step is a help request with the student's words passed to the matcher as context. No required phrase.
(3) Tests cover varied phrasings and near-misses, and spoken playback with the network disabled.
(4) npm test and the e2e tests pass.
Ask clarifying questions first, then show the plan for approval before writing code.

Clarification replies:
- Missing voice doc: "check again". The file was present on the next check and read.
- Enable narration once after unlocking, then automatically speak new explanations,
  answers and feedback; keep captions and controls visible.
- "pause here" requests another explanation; "pause audio" stops narration.

Approved plan: locally generated compressed clips for the fixed demo plus local
browser synthesis fallback; always visible captions/playback/speed controls; six
conservative command intents and otherwise matcher context; tests and demo docs.
Tradeoff stated before approval: clips increase download size and need regeneration
when captions change; synthesis depends on installed local voices. No schema
change proposed: reuse audioAssetPath and a fixed-demo internal caption manifest.

## 21. Approve voice implementation

approve

## 22. Workspace-drive constraint

What do you mean I should free up 200mb on both drives? Use the d drive alone

Corrected the earlier drive-space claim: D: has approximately 300 GB available.
Generation intermediates, audio clips, npm cache/logs, and test temporary files
are on the D: workspace. The initial system-temp write failed; no user files
were deleted. Read-only access to installed system voices/FFmpeg remains necessary.

## 23. Review and publish for approval

Review your diffs in this session and commit to a new branch then create a pull request for me to approve

Review scope: the local and remote repositories have no prior commits. Create an
empty main-branch base, then commit the complete proof of concept on a feature
branch so the implementation remains reviewable in a pull request. Do not merge.
Keep temporary files and generated test artifacts on D: and outside the commit.

## 24. Technical foundation audit (no feature implementation)

# Goal

Inspect the existing Coteacher repository and establish a reliable technical foundation for completing the hackathon sprint.

# Context

Coteacher is an offline-first adaptive learning platform. Teachers prepare and approve lessons, students revisit those lessons offline and receive targeted help, and the resulting learning data returns to teachers.

We are building a working proof of concept using one lesson, two learner profiles, and clearly labelled simulated classroom data.

# Constraints

- Inspect the repository before making changes.
- Preserve the current framework, architecture, styling, and working features.
- Do not rewrite the application from scratch.
- Do not introduce unnecessary dependencies.
- Do not remove functionality simply because it is outside the immediate sprint.
- Do not claim a feature is functional based only on its UI.
- If the repository already supports a requirement, reuse that implementation.

# Done When

1. Identify the frontend, backend, database, authentication, offline storage, service worker, and AI integrations currently used.
2. Map the existing teacher and student journeys to actual routes, components, services, and data models.
3. Identify which sprint requirements are implemented, incomplete, missing, or unverifiable.
4. Run available lint, type-check, build, and test commands.
5. Identify the smallest dependency-aware implementation order for missing functionality.
6. Produce a concise technical report with relevant file paths, important risks, and immediate blockers.

Do not implement new features during this first task.

## 25. Teacher preparation, source grounding and publication approval

# Goal

Ensure a teacher can prepare one complete, source-grounded lesson and approve it before it becomes available to students.

# Context

Coteacher must be based on the actual classroom lesson rather than arbitrary AI-generated content.

A teacher provides notes, textbook sections, or other reference materials. Coteacher organizes the material into identifiable concepts with learning objectives, explanations, visuals, and questions.

The teacher remains responsible for approving instructional content.

# Constraints

- Inspect and reuse existing lesson creation functionality.
- Support one complete demo lesson; a curriculum-wide authoring system is unnecessary.
- Every concept must retain a reference to its source material.
- Preserve the original learning objectives across alternative explanations.
- If AI generation exists, distinguish it from seeded or manually prepared content.
- Do not fabricate citations or claim source verification that has not occurred.
- Do not allow unapproved content to be published to learners.
- Preserve existing UI patterns and architecture.

# Done When

1. A teacher can create or select a lesson with a subject, topic, class level, and learning objectives.
2. The lesson contains identifiable reference material.
3. The lesson is organized into stable concept segments.
4. Each concept can contain an original explanation, relevant visual, alternative explanation, and understanding check.
5. The teacher can review the material before publication.
6. Approval changes the actual publication state, not just a visual label.
7. Unapproved lessons cannot be collected by learners.
8. The lesson remains available after refresh or restart.

Verify the complete teacher preparation flow and report the files changed, tests performed, and remaining limitations.

Session instructions: read product context before work; preserve existing architecture,
offline operation, source references, safe activity and shared objectives; save
session prompts here. Acceptance for this task: draft imports blocked; source and
concept review available; persisted approval enables encrypted export; refresh and
tab reopening restore preparation; regeneration/source changes require review;
the existing offline demo continues to pass.

## 26. Manual classroom presentation and exact-concept learner revisit

# Goal

Implement or verify a classroom presentation mode where the teacher manually advances lesson visuals and creates a timeline that learners can later revisit.

# Context

Coteacher needs to preserve the structure of the lesson that was actually taught.

During the sprint, the teacher manually advances the presentation. Automatic speech-following is future work.

The timeline must connect each classroom concept to the relevant explanation and visual in the student's offline lesson.

# Constraints

- Reuse the lesson and concept models from the existing application.
- Every concept must have a stable identifier.
- Do not implement automatic speech recognition or real-time transcription.
- Do not create a separate disconnected presentation dataset.
- The student experience must reference the same concept identifiers.
- Do not overwrite approved lesson content during presentation.
- Maintain a clean, projector-friendly interface.

# Done When

1. The teacher can start the approved lesson in presentation mode.
2. The teacher can move forward and backward between concepts using controls.
3. Each concept displays its corresponding explanation or visual.
4. The presentation maintains a concept timeline.
5. The timeline references the same lesson content available to learners.
6. Presentation state is reliably preserved where appropriate.
7. A student can subsequently open the corresponding concept from the learner interface.
8. The interface works without requiring voice or automatic speech-following.

Test that the exact classroom concept can be revisited by a student rather than merely opening the general topic.

Acceptance for implementation: approved-only presentation start; manual previous/
next and exact-step selection; persistent current step and actual display visits;
same classroom timeline references in both encrypted learner packages; unchanged
approved instructional content; offline learner navigation to the precise step
and concept including repeated moments; errors/boundaries handled; existing demo
acceptance passes. No automatic speech/transcription is implemented.

## Teacher audio recording and visual synchronization — 2026-10-09

User prompt (verbatim):

# Goal

Implement or verify a classroom recording system that captures the teacher's lesson audio while maintaining a synchronized timeline of the visuals presented during teaching.

The recording and timeline must provide the foundation for creating personalized, video-like lesson experiences that students can watch after class.

# Context

Coteacher is designed to let students return to the actual lesson their teacher delivered.

During the lesson, the teacher uses Coteacher to display approved visual aids and advances those visuals manually as they teach.

Coteacher records the teacher's audio and tracks when each visual or concept is presented.

After the lesson, this recording and timeline will be used to build personalized lesson packages.

For the sprint, manual synchronization is sufficient. Automatic following of the teacher's speech is a future feature.

# Constraints

- Inspect and reuse existing lesson presentation functionality.
- Record the teacher's audio using appropriate browser capabilities or an existing recording service.
- Require microphone permission and make recording status visible.
- Do not record students or classroom conversations unnecessarily.
- Associate recording timestamps with stable lesson and concept identifiers.
- Record the moment each visual is displayed relative to the audio timeline.
- Preserve the relationship between the teacher's recorded explanation and its approved instructional visuals.
- Do not implement automatic speech transcription or speech-following unless already working.
- Do not treat a silent slideshow as a recorded lesson.
- Preserve the ability to review the recording and timeline before publication.
- Keep the implementation compatible with the existing architecture.

# Done When

1. The teacher can open an approved lesson in presentation mode.
2. The teacher can start, pause where supported, and stop an audio recording.
3. The teacher can advance through visuals manually while teaching.
4. Every visual transition is associated with a timestamp in the recording.
5. Recording and timeline timestamps remain aligned, including after pauses.
6. The recording and visual timeline are saved.
7. The teacher can replay the recording with the corresponding visuals displayed at the correct times.
8. The teacher can review the recorded lesson before publishing it.
9. The recorded lesson remains associated with the original lesson and concept identifiers.
10. The resulting media and timeline can be consumed by the personalized lesson package system.

Verify the complete recording → timeline capture → synchronized playback journey.

Report what was implemented, how synchronization works, the tests performed, and any known browser limitations.

Acceptance: approved-only, explicitly enabled teacher microphone capture; actual
non-silent audio; sample-based cues for every displayed transition; pause excludes
samples and resumes at the current visual; stopped audio/cues persist together;
draft recordings cannot be exported or collected; reviewed media uses the same
lesson revision, steps, concepts and sources in both personal routes; seek and
playback synchronize visuals offline; permission/storage errors release capture
and preserve reviewable state. Verify existing demo acceptance too.

## 2026-10-09 — Personalized offline recorded lesson replay

User: Why two minutes recording cap?

User goal: Implement a personalized, offline-ready lesson package containing the
teacher's recorded lesson audio and synchronized instructional visuals tailored to
each learner. Students must watch an engaging, video-like lesson offline, with
interactive learning, alternative explanations, activities, quizzes and saved questions.

The teacher's original audio remains the foundation, with meaningful source-grounded
visual differences for two simulated profiles and unchanged objectives and chronology.
Inspect existing recording, timeline, lesson, profiles and PWA. Include complete audio,
synchronized timeline, actual visual assets and stored personal choices. Teacher reviews
variants before publication. No student AI or trained-model claims. Share large audio
locally across profiles; optimize Android storage; verify actual media collection,
offline readiness and missing assets. Preserve architecture and original audio meaning.

Acceptance: approved recording → reviewed deterministic personal sequences → encrypted
packages for A and B → distinct instructional visuals with identical audio/objective →
atomic, deduplicated local media collection → offline audible playback/seek/exact-concept
study/help/activities/quizzes/questions → isolated saved positions → restart and resume.
Test native browser audio, both profiles, publication gates, missing/corrupt assets,
pause synchronization and a recording longer than 120 seconds. Document contracts,
personalization, synchronization, media storage, tests and browser limitations. Existing
source-only fixtures must be honestly labelled and remain usable for the original demo.
Do not call a silent slideshow or an uncached media URL a completed recorded lesson.

Full user request:

# Goal

Implement a personalized, offline-ready lesson package containing the teacher's recorded lesson audio and synchronized instructional visuals tailored to each learner.

Students must be able to watch the lesson as an engaging, video-like educational experience while offline.

The package must also support interactive learning, alternative explanations, activities, quizzes, and saved questions.

# Context

The Coteacher lesson package is not simply a collection of notes, slides, and quizzes.

It is a personalized replay of the classroom lesson.

During the original classroom session, the teacher's audio was recorded and the visual presentation timeline was captured.

Coteacher uses the recording and timeline to assemble an individualized lesson experience.

The teacher's original audio remains the foundation of the lesson.

However, the visual presentation can differ between students depending on their needs, previous difficulties, and available learner information.

For example:

Learner A might receive animated fraction diagrams, practical demonstrations, and visual representations.

Learner B might receive numerical examples, step-by-step transformations, and mathematical annotations.

Both students hear the same teacher explaining the same learning objective, but the supporting visuals are personalized.

The result should feel like watching an engaging educational lesson video rather than navigating a static slide deck.

# Constraints

- Inspect the existing recording, timeline, lesson content, learner-profile, and PWA implementations before making changes.
- Every package must include or locally reference the complete required teacher audio recording.
- Every package must contain the synchronized visual timeline.
- Every package must contain the actual visual assets required for offline playback.
- Each student's personalized visual selection must be stored in their lesson package or package manifest.
- Personalization must meaningfully alter the instructional visuals, not merely the learner's name, theme, or labels.
- Visuals must remain consistent with what the teacher is saying at each point in the recording.
- Do not insert visuals that contradict the recorded audio or change the learning objective.
- All instructional visuals and explanations must remain grounded in teacher-approved sources.
- The teacher should be able to review personalized visual variants before publication.
- For the hackathon sprint, deterministic personalization based on two simulated learner profiles is acceptable.
- Clearly identify simulated personalization rather than claiming a sophisticated trained recommendation model.
- Do not require real-time AI generation on the student's device.
- Preserve the recording's original meaning and chronology.
- Avoid duplicating large audio files unnecessarily when two learner profiles share a device.
- Optimize media and caching for low-end Android devices.
- The entire prepared playback experience must work without internet after collection.
- Do not assume that simply caching the player interface means the media has been downloaded.
- Preserve the existing project architecture where practical.

# Done When

## A. Lesson package generation

1. The system retrieves the approved teacher recording and its synchronized timeline.
2. It associates the timeline with stable lesson and concept identifiers.
3. It identifies the approved visual variants available for each concept.
4. It creates a personalized visual sequence for Learner A.
5. It creates a meaningfully different visual sequence for Learner B.
6. Both sequences follow the same recorded teacher audio and learning objectives.
7. The system produces a package or package manifest identifying the recording, visual assets, timeline, explanations, activities, and quizzes.
8. The package is associated with the correct learner profile.
9. Necessary media and assets can be saved locally for offline use.

## B. Interactive lesson playback

10. The learner can open the package and play the teacher's recorded lesson.
11. The teacher's voice is audible throughout the relevant recording.
12. The appropriate visual appears automatically at the correct timestamp.
13. Visual transitions remain synchronized with audio playback.
14. The student can pause, resume, seek backward, and seek forward.
15. Seeking to a different timestamp updates the displayed visual correctly.
16. The interface feels like an educational video player, with the audio and visuals forming one coherent presentation.
17. The student can access the corresponding lesson concept while watching.
18. The student can pause at a concept and request further explanation.
19. Playback position and lesson progress are saved.
20. The student can resume from their previous position.

## C. Personalized playback

21. Learner A watches the recorded lesson with their assigned visual presentation.
22. Learner B watches the same teacher's recording with a different visual presentation.
23. The differences are meaningful and appropriate to the concept.
24. Each learner retains their own playback position and progress.
25. Switching profiles does not expose or overwrite another learner's progress.
26. Personalization remains consistent with the recorded explanation.
27. A learner can access approved alternative explanations where available.

## D. Offline reliability

28. The learner downloads or collects the complete required package while connected.
29. Coteacher clearly indicates when the package is ready for offline playback.
30. The device is disconnected from the internet.
31. The learner reloads or reopens the PWA.
32. The recorded lesson still plays with audio.
33. The synchronized visuals still appear at the correct times.
34. The learner can pause, seek, resume, and navigate concepts without network access.
35. Prepared explanations, activities, and quizzes remain available.
36. Playback state survives refresh or application restart.
37. Missing or incomplete assets are reported clearly.

## E. Testing

Run an end-to-end test demonstrating:

Teacher recording + timeline → personalized package generation → Learner A playback → Learner B playback with different visuals → network disconnection → offline audio-visual playback → resume after restart.

Verify that the offline media does not depend on streaming from a remote server.

Document the package structure, personalization mechanism, synchronization mechanism, media storage strategy, tests performed, and remaining limitations.

Do not consider the task complete if the student can only view static slides without the teacher's recorded audio.

## 2026-10-09 — Review, commit and publish a new pull request

User prompts:

> Review all the code changes you have made and commit and push to the new branch. Ioen a new pr for me to accept

> continue

Acceptance: review all pending lesson preparation, presentation, recording and personalized offline replay changes; fix material review findings; pass contract, unit, build, demo and browser checks; commit only session-owned work on a fresh branch; push it and open an unmerged pull request for the user to review. Preserve the unrelated untracked docs/technical-audit.md. Existing PR #1 remains open, so the new PR uses its feature branch as the base to isolate these additions.

Review finding: include the MIME type in cached audio-container validation, so changing a previously checked WAV to an Opus declaration cannot reuse the WAV result. Add a regression test exercising validation before and after the mutation.

Final verification for this review: npm.cmd test passed 334 tests across 12 files, generated-type freshness and TypeScript; npm.cmd run test:e2e passed all 22 browser tests in 2.4 minutes and built both applications; npm.cmd run pipeline -- --lesson fixtures/demo-lesson passed. The full native recording/timeline → A/B personalized playback → network disconnection → offline playback/restart journey passed on the final build. The staged diff passed whitespace checks. The only review fix was MIME-aware cached audio validation, with its regression test. Chromium's generated debug.log is removed from the workspace and excluded from the commit; docs/technical-audit.md remains untouched.
