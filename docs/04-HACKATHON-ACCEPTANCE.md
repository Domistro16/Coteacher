# Coteacher — hackathon ship checklist

## Priority and stop rules
P0: end-to-end recorded lesson, one actual connected sourced two-turn AI interaction with spoken response (if credentials/service available), contextual help, quiz, resume, and a truthful demo. P1: offline reopen/queue/reconnect, separate learner evidence and teacher insights. P2: polish and advanced cross-lesson transfer. No P2 work until P0 passes. If GPT-Live blocked, report exact error and preserve a truthful fallback; never block submission indefinitely.

## End-to-end tests
1. Teacher uploads/reviews lesson sources, selects approved visuals, records actual microphone audio with timed visual cues, reviews and approves.
2. Student A sees a video-style package card; opens recording, plays, pauses, seeks and sees correct visuals; animated scene progressively builds, transitions and watermarks work.
3. Talk pauses at exact timestamp. Avatar appears inside unchanged player; starts listening, not reciting. Connected real provider responds verbally to a novel lesson question; a follow-up works in same session; close returns to saved timestamp.
4. Student A answers a concept check incorrectly and requests alternate explanation. Events persist after restart. Student B performs different actions. Recommendation differences cite real evidence; both retain objectives/audio and approved visual IDs.
5. Download lesson, go offline, restart PWA, play recording/visuals, receive prepared help, queue unmatched question, switch learner profiles safely, reconnect and resolve queued question without duplicates.
6. Teacher sees received questions, concept difficulties, quiz outcomes and evidence-backed insight. No fabricated data presented as real.

## Verification truthfulness
Report PASS, PARTIAL, FAIL or NOT TESTED with specific evidence. Distinguish mocked microphone/provider, live provider, physical Android and simulated learner data. A browser 'online' badge is not proof of working AI. Test microphone capture and real API separately. Check build, typecheck, relevant unit/browser tests, and no regressions.

## Submission readiness
- Repository commit with reproducible setup and safe `.env.example` (no secrets).
- README: run instructions, supported browser, online/offline limitations, demo credentials for fictional profiles only, API cost warning, and simulated features.
- 2–3 minute video or live script: teacher recording → personalized playback → ask/answer/quiz → offline/reconnect → teacher insight.
- Capture working screenshots/video before optional fixes. Reserve final submission buffer; freeze new features before deadline.

## Failure budget
Time-box investigation. After ~30 minutes on a single blocker, stop, document exact failing stage and choose a truthful demo-safe path. Do not rewrite unrelated code or silently substitute mocks. Do not declare READY without complete evidence.
