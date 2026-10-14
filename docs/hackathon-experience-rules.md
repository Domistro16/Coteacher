# Coteacher — Hackathon Experience & Implementation Rules

> **Purpose:** This document defines the intended teacher/student experience, online/offline behaviour, and implementation guardrails for the Coteacher hackathon proof of concept. Read it alongside `docs/product-brief.md`, `docs/scope.md`, `docs/demo-acceptance.md`, `docs/safety-and-data.md`, and the schemas. It supplements rather than replaces those documents.

## 1. The product journey is the acceptance standard

**Teacher:** Create/select a lesson → supply sources → review and approve explanations and animated visuals → present and record real teacher audio with timestamped visual transitions → review synchronized recording → preview learner-compatible visual variants → publish packages → inspect synchronized learner struggles and teaching suggestions.

**Student:** Sign in → see a welcoming lesson library → stream or download a published package → watch the teacher's real recorded audio with synchronized, personalized animated visuals → interrupt at the exact moment of confusion → converse with Coteacher → complete a relevant quick understanding check → resume at the saved playback position → sync progress and unanswered questions when possible.

All features must form **one continuous experience**. Do not substitute text-only lesson pages, a static slide deck, or a separate generic chatbot for this journey.

## 2. Online and offline: same interface, different capabilities

| Capability | Connected | Offline after full download |
|---|---|---|
| Recorded lesson | Stream or use local copy | Play locally stored audio, timeline, and visuals |
| Visual personalization | Use approved compatible variants; refresh packages where supported | Use locally stored approved variant sequence |
| Coteacher help | Real configured AI for new sourced questions; connected voice where available | Approved prepared explanations and answers only |
| Speaking and listening | Bidirectional GPT-Live when configured and **verified**; text fallback | Bundled prepared audio if available; text always works. Do not assume offline speech recognition |
| Unknown question | Ask real connected AI with source checks; defer if unsupported or service fails | Persist the exact question, learner, concept, and timestamp for later resolution |
| Quizzes and progress | Local persistence; sync only after server acknowledgement | Work locally and queue events for later sync |
| Synchronization | Automatic where supported, with honest success/failure status | Keep data on device; manual transfer remains accessible from a secondary Sync & Transfers area |

**Clarification of `AGENTS.md` offline rule:** “No network call on the student core path” applies to the *downloaded offline-learning path*. It does **not** prohibit explicitly initiated connected AI tutoring, streaming, publication or sync. Never silently pretend a connected API response happened when it did not.

## 3. Exactly one tutoring interface

- The **floating Coteacher avatar lives inside the existing lesson player**, normally at the bottom-right. It must not shrink the player or open a modal, sidebar, nested scrolling chat, or a competing “Ask Coteacher” page.
- Activating tutoring pauses the teacher recording and preserves `learnerId`, `lessonId`, `conceptId`, and playback timestamp. The avatar **listens first**, instead of automatically reading a prepared explanation.
- If online voice mode is enabled and available, use the actually configured live speech conversation service. Do not substitute browser TTS or prerecorded text and call it GPT-Live. Voice use needs clear microphone consent/status and an easy stop control.
- Offer compact text entry and push-to-talk fallbacks without rebuilding the UI. On offline devices without recognized speech, text is the reliable input.
- The avatar answers based on the current concept and approved source context, invites follow-ups, asks whether the explanation helped, offers a short concept-specific check, and returns to the teacher recording at the preserved position.
- Student self-confirmation is **not** proof of mastery. Record quiz evidence separately.
- Explicit user extension (14 October 2026): spoken quick-check acceptance opens
  a quiz modal over the existing player. Ground it in the actual asked question
  and checked sources; adapt support from this learner's observed history while
  preserving the objective. This overrides the earlier no-modal rule for quizzes
  only. The floating tutoring interface is unchanged. See contextual-quiz-acceptance.md.
- Respect student consent, do not record when voice mode is disabled, and stop microphone capture when the live session ends.
- Keep technical API/provider/source-debugging details out of the main child-facing conversation; required consent and understandable availability messages remain accessible.

## 4. Recorded lesson and animated visuals

- The teacher's **actual captured recording**, not generic TTS, is the basis of the lesson package. Keep audio, visual events, source references, and stable concept IDs connected.
- Use **educational explainer animation**, where shapes, rays, labels, and annotations progressively appear to construct the idea. A moving highlight over a finished static diagram does not qualify.
- For the demo, aim for meaningful **5-second repeating visual sequences** and polished transitions between concepts. The visual must still make sense if a student pauses early.
- Keep animation tied to the playback clock: pausing/playing/seeking and recorded visual transitions must restore the right state. In teacher presentation, do not break timestamp capture.
- The same teacher audio may be paired with different **teacher-approved, narration-compatible** visual variants. Never contradict what the teacher says or alter the shared learning objective.
- Show a subtle Coteacher watermark at the bottom-right of student/projector instructional visuals. Support reduced motion, offline assets, and low-end Android performance.
- The teacher-facing studio should keep recording controls and visual advancement accessible without scrolling. The separate projector view shows only student-facing teaching visuals.

## 5. Learner memory and teacher feedback

- The hackathon uses two **fictional learners**. Their recommendations should increasingly reflect actual recorded interactions: explanation requests, questions, quiz attempts, retries, and explicitly chosen representations—not prewritten learning histories.
- Store each learner's progress, questions, and memory separately on shared devices; persist across refresh and restart.
- Distinguish **observations** (e.g., two wrong quiz attempts) from **hypotheses** (e.g., the learner may need a diagram). Never infer fixed learning styles, intelligence, diagnoses or personalities.
- Use approved visual/explanation variants to adjust the route, **never the objective**. If evidence is limited, use the default.
- Show the teacher concept-level difficulty indicators and actionable suggestions. Clearly label simulated class aggregates separately from real demo events. Do not claim causal effectiveness from small simulated data.

## 6. Sources, AI honesty, and safety

- Approved teacher content takes priority. Curated external sources may supplement it for connected AI tutoring only where the feature is configured; preserve identifiable source references and do not fabricate citations.
- Validate sources and handle uncertainty. If there is not enough trustworthy support, defer honestly rather than inventing an answer.
- Only teacher-approved, safe, age-appropriate hands-on activities enter a student package.
- Make connected AI opt-in and disclose that selected question/context information is sent to an external provider. Keep API keys server-side; exclude student names and PINs from AI requests.
- Never claim offline GPT-Live, real learning gains, real cloud distribution, true human-microphone verification, or production privacy/security unless actually demonstrated.

## 7. Avoid recurring implementation mistakes

- **Do not implement an easy-looking substitute:** a tiny moving line is not a fully animated concept; a fullscreen webpage is not a separate projector display; an avatar icon plus a text form is not a conversational voice tutor.
- **Do not create duplicate UI paths:** lesson player, help, quiz, activities and resume must be part of the same journey.
- **Do not redesign unrelated UI to fix connectivity, or rebuild backend services to fix layout.** First locate the true failing stage.
- Preserve existing working recording, offline packages, encrypted transfers, stable IDs, and student/teacher styling.
- No unnecessary frameworks, infrastructure rewrites, new databases, hosted deployment, or unrelated feature expansion during this sprint.
- When requirements conflict with an older `docs/scope.md` or contracts, **report the conflict first**, then update the smallest necessary contract/docs before code. Do not silently discard the new requirement.
- Track every requested task with a specific goal, constraints, observable “done when” criteria and tests. Do one bounded vertical task at a time; when blocked or over the agreed time budget, stop and report rather than continuing for hours.

## 8. Mandatory proof before saying “done”

1. **UI:** actually open the browser; compare before/after player geometry and screenshots; test desktop and narrow mobile widths. No sidebar/modal when the floating avatar is requested.
2. **Live AI:** show an authenticated real provider request, answer and contextual follow-up, or clearly mark **UNVERIFIED** with the failure stage. Mocked tests are not proof of live AI.
3. **Recording:** test real human microphone input where available; simulated audio verifies only the pipeline.
4. **Offline:** download all necessary assets, disconnect, reload the PWA, play recorded audio/visuals, ask prepared/unprepared questions, save progress, and switch profiles.
5. **Sync:** reconnect; verify server acknowledgement, no duplicated/mixed events, returned deferred response and teacher dashboard impact.
6. **Regression:** run available build/type checks and relevant unit/browser tests; preserve the demo journey.

After every task, report **what changed, what stayed working, exact tests performed, actual vs mocked evidence, remaining limitations, and PASS/PARTIAL/FAIL/UNVERIFIED** for the relevant journey. Do not overstate completion.

## 9. Hackathon priority order

1. Reliable teacher recording and personalized recorded-lesson playback.
2. Real connected conversational tutoring (one voice/text help experience).
3. Relevant follow-ups, understanding checks and safe prepared offline help.
4. Persistent independent learner evidence and usable adaptation.
5. Offline replay, queued questions and successful reconnect/sync.
6. Teacher concept insights and recommendation.
7. Final tested demo, honest limitations and submission.

If time runs short, **ship the smallest truthful end-to-end loop** rather than introducing features that endanger it.
