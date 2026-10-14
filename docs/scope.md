# Scope for the sprint

## Build for real

- Package generator (notes + sources to lesson package, validated against the schema)
- Tap-to-advance lesson player with timeline and variant switching
- Offline PWA (service worker, local storage)
- Question bank with matcher, honest no-match, and a queue of unmatched questions
- Push-to-talk with a typing fallback
- Quiz built from the student's pause points
- Two student profiles on one device with different routes to the same objective
- Teacher-reviewed recorded replay with distinct prepared visual scenes for those
  two simulated profiles, complete local audio and independent resume positions
- Recorded replay as the default learner interface; actual loopback publication,
  streaming, verified downloads and shared local media for the one recorded demo
- Inspected history/default visual decisions and offline paused help using the exact
  recorded cue, approved alternative representations and each learner's own history
- One hands-on "Try it" variant linked back to the teacher's original moment
- Progress export and import as plain files
- Guided teacher workspace sharing the student design, synchronized default/A/B
  review, real package readiness, exact-concept questions and dedicated transfers
- Acknowledged local school progress/answer return for the currently published
  recording; encrypted durable snapshots, offline retry and manual fallback
- Stable learner event IDs and encrypted receipt checkpoints; delayed acknowledgements
  preserve newer local work, and prepared deferred responses carry simulated provenance
- Teacher view: heatmap, variant stats, and a next-lesson nudge

## Seed and label as simulated

- Larger-class heatmap data
- Variant-testing results
- Previous-cohort confusion data behind the nudges
- Student histories behind personalization

## Described only (stub behind an interface; do not build)

Explicit sprint extension: opt-in connected OpenAI tutoring, connected short voice
questions and evidence-backed within-lesson learner memory are implemented behind
the existing local Node service. See connected-tutor-acceptance.md. Generated
answers need source validation and teacher oversight, not individual preapproval;
offline prepared packages and publication still require approval. Only fictional
profiles are supported; real-child deployment and cross-lesson memory are deferred.
The user explicitly extended this to GPT-Live avatar speech with client delegation
to the same backend tutor. It remains an opt-in connected student interaction,
not automatic teacher speech-following or offline real-time AI. Existing approved
package content, teacher audio and manual classroom timelines remain intact.

User extension (14 October 2026): connected source-checked quick checks can be
generated for an actual student question and personalized from received learner
observations. They open in a quiz modal on spoken acceptance and persist with
attempts in the existing encrypted tutor record; downloaded checks work offline.
Prepared package quizzes remain approved content. No exam-practice mode or new
infrastructure is introduced. See contextual-quiz-acceptance.md.

- Automatic following of the teacher's speech
- Full exam-practice mode
- On-device speech models for local languages
- Notifications for queued answers
- School-owner view
- Hotspot transfer, public cloud hosting and production delivery/authentication
  (the explicitly requested loopback demo delivery service is implemented)
