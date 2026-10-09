# Safety, privacy and data rules

## Content
- Every explanation, question-bank answer, quiz item and Try it activity has `sourceRefs` pointing to entries in `sources`.
- Content is generated and checked against the sources before it is published. If a claim cannot be traced to a source, it is flagged, not shown.
- Cite textbooks by reference and page. Do not reproduce long passages.

## Try it activities
- Safe, common household items only. No heat, chemicals, sharp tools, or anything a child could be hurt by.
- Each activity has `items`, `steps`, `explainsWhy`, `safetyNotes`, and `returnToStep`.
- Offer Try it only where a simple safe activity exists.

## Personalization
- Same learning objective, teacher audio and concept chronology for every student;
  the route and teacher-reviewed supporting visual choices may differ.
- Show the student why something was added and let them skip it or switch to the teacher's original.
- Never label a student as a learner "type."

## Data
- No real children's data in fixtures, tests, or demos. Use fake names and pseudonymous ids.
- Seeded data carries `"simulated": true` and is visibly marked in the UI.
- Personal packages and progress files are protected by a profile PIN. Keep sensitive data out of the lesson file itself.
- Student voice commands are processed locally where supported; their raw audio
  is never stored. Teacher lesson recording is explicitly enabled and permission
  gated, with a visible microphone status. Use a close teacher microphone and
  pause/mute capture for student speech and classroom discussions. Only teacher
  audio is intended for recording; the browser cannot isolate individual voices.
- Stopped teacher audio and source-linked visual cues stay in the teacher's local
  IndexedDB as a private review draft. Review instructional accuracy, timing and
  privacy before separately approving the recording for encrypted learner export.
  No recognition, upload, voice cloning or automated source verification occurs.
  Browser recordings in tests use simulated inputs, never children or classrooms.
- Personalized SVG scenes are prepared manually from the reviewed notes and selected
  by explicit simulated profile-history rules. They are not generated transcripts,
  trained recommendations or a diagnosis of learner types. Teacher visual approval
  is separate from audio approval. Shared stored audio is encrypted; its key remains
  inside each learner's PIN-protected snapshot. Public demo PINs are not production
  authentication, and same-origin scripts can access unlocked content.
- Teachers see aggregates by default. Student-level data stays with the student and school.
