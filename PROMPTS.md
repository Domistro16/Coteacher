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
