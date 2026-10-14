# Coteacher — non-negotiable experience rules

## Design principles
Child-friendly, imaginative, uncluttered, and easy to understand. Preserve the existing Coteacher purple/dark-navy visual identity and established navigation. Do not copy proprietary UI assets from other products. Prioritize comprehension over decorative motion.

## Student lesson player
- A stable immersive 16:9 lesson stage is the visual anchor. Opening tutoring MUST NOT change player dimensions.
- One tutoring surface only: small animated character floating in bottom-right INSIDE stage, compact speech bubble beside it, and minimal voice/text input. Avoid covering key diagrams or playback controls; reposition if necessary.
- NO tutoring sidebar, fullscreen modal, nested scrollbars, chat dashboard, duplicate help form, or technical backend explanation in the child's primary interaction.
- Avatar must listen before answering. Do not autoplay generic prepared explanation when Talk is clicked. Clearly indicate listening, thinking, speaking, offline prepared, queued and error states.
- Speaking answer uses actual configured voice route; do not claim generic browser TTS is live AI voice. Text fallback remains available.
- Conversation flow: ask → grounded explanation → follow-up/another way → understanding question → optional short quiz → resume exact timestamp. Do not require unnecessary clicks.

## Motion graphics
- A concept animation should build the explanation from blank/initial state: source appears, ray draws/travels, arrow forms, labels reveal, scene settles, then repeats (~5 seconds where appropriate).
- A tiny moving highlight over a finished diagram is NOT sufficient. Smooth transitions between cue changes. Playback/seek/pause must keep the correct cue and animation state. Respect reduced motion.
- Show subtle Coteacher watermark bottom-right without obstructing content. Keep audio-visual teaching accurate; never animate physically incorrect claims.

## Teacher studio
- Teacher sees large stage, recording timer, microphone status and previous/next visual controls without scrolling. Clean projector window shows only instructional visuals. Opening/closing projector must not interrupt recording. Teacher reviews synchronized recording before publishing.

## Accessibility and mobile
- Controls have readable labels, keyboard/touch access and adequate targets. Captions/transcripts where available. Compact avatar on mobile must not block lesson content; provide safe reposition/collapse if needed. No persistent microphone capture without explicit permission and indication.

## Visual acceptance gate
For UI tasks, capture real browser screenshots at desktop and mobile widths for before/after, active help state, and lesson playing state. Compare against these rules. A passing component test is not proof of UX compliance.
