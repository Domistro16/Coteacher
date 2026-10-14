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
- Do not create or commit PROMPTS.md; session prompt logging was removed at the user's request.
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

The pipeline validates hand-written packages and generates encrypted simulated
packages from the supplied reviewed materials. The full application demo is
implemented; see docs/demo-acceptance.md and docs/sprint-status.md for limits.

Contract workflow and validation APIs: `docs/contracts.md`. On Windows PowerShell
with script execution disabled, use `npm.cmd` in place of `npm`.

## Common Mistakes and Pitfalls

1. **Implementing superficial functionality:** Do not substitute a simplified visual effect or UI element for the actual requested feature. For example, animating a small line on a static diagram is not the same as creating a fully animated educational explanation.

2. **Building disconnected interfaces:** Do not implement features as separate forms or screens when they are supposed to work together. The lesson player, AI assistance, quizzes, and activities should form one continuous learning experience.

3. **Confusing simulated functionality with real functionality:** Passing automated tests with simulated microphone input does not prove that recording works correctly with a real teacher. Always distinguish mocked, simulated, and genuinely verified behaviour.

4. **Ignoring the intended user journey:** Do not focus only on completing individual requirements. Understand how teachers and students are supposed to experience the entire system before implementing a feature.

5. **Treating UI changes as functional implementations:** A fullscreen webpage is not necessarily a proper projector mode. Similarly, a static explanation panel is not the same as a conversational AI teaching assistant.

6. **Overlooking audio-visual synchronization:** Animations, lesson visuals, teacher recordings, and playback controls must remain synchronized during playing, pausing, seeking, and resuming. Never allow independent animation timers to cause incorrect visuals at a recorded timestamp.

7. **Assuming browser capabilities work offline:** Speech recognition, text-to-speech, media streaming, and synchronization may depend on browser support or connectivity. Verify actual offline behaviour instead of assuming API availability.

8. **Making technical infrastructure part of the student's learning experience:** Keep features such as manual progress export, file imports, and synchronization management away from the main lesson interface unless the student explicitly needs them.

9. **Declaring tasks complete without testing the real interaction:** Do not mark a feature complete merely because its components render or unit tests pass. Verify the actual behaviour against the intended user journey, including offline operation and real-device limitations.

**General rule:** Implement the intended experience, not merely the easiest technical interpretation of the requirement. When a requirement is unclear or technically constrained, identify the limitation rather than silently replacing it with something simpler.

- User journeys, online/offline behaviour, AI avatar UX, and hackathon implementation rules: docs/hackathon-experience-rules.md. Read before modifying any teacher or student experience.
