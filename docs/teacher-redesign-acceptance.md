# Teacher workspace acceptance

This task reuses the current student brand and existing source preparation,
native microphone recording, review, personalized playback, local publication,
encrypted progress and answer-transfer implementations.

- A dashboard and lesson library lead into a persisted, guided preparation flow.
- Sources accepted by the actual generator (.md/.txt, under 50 KB) are inspected
  before bounded simulated preparation. Approval remains a real persisted gate.
- Recording controls retain microphone permission, visible capture state,
  sample-clock cues, pause exclusion and save-failure protection.
- Review provides synchronized playback and selectable approved learner visuals;
  audio and visual approval remain separate from publication.
- Publication only reports success after the service acknowledges the complete
  reviewed recording. Readiness and missing media are visible.
- Insights, exact-concept questions and validated school transfers have separate
  screens. Seeded observations and local answer simulation remain identified.
- A bounded direct progress return through the existing loopback service may be
  added with validated ownership, durable storage, acknowledgement, independent
  profiles and offline retry. Connectivity alone is never acknowledgement.
- Desktop, tablet and narrow mobile routes work with keyboard focus, readable
  contrast, reduced motion and no horizontal overflow.

Validation: types/contracts, existing unit and browser acceptance, native
recording/publication/replay journey, transfer roundtrip, responsive screens,
failure handling and offline reconnect/profile isolation. No teacher account,
cloud delivery, automatic transcription or arbitrary live AI is invented.
