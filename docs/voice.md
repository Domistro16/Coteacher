# Voice: input, spoken replies, and intent handling

**Principle:** voice is the interface; text is the internal representation. Everything Coteacher says is spoken aloud AND shown as captions. The student should never need to read to use it, and never needs to hunt for buttons.

## Input (push-to-talk)
- The microphone listens only while the button is pressed.
- Online: browser speech recognition or an open-source model. Offline in the sprint: typing is the fallback. On-device open-source recognition (for example Whisper- or Vosk-based) is a stretch goal or next step; test it on Nigerian accents before relying on it.
- If recognition is low-confidence or unavailable, ask the student to type. Never guess.

## Output (Coteacher speaks back)
Every explanation, matched answer, no-match message, quiz feedback and Try it instruction is spoken in a friendly, youthful, student-like persona. Do not imitate or clone the teacher's voice. Mechanism, in order of preference:
1. **Pre-generated audio** per variant and answer, produced by the pipeline at package build time with a text-to-speech model (open-source or cloud) and shipped as small compressed files (the `audio` field in the schema). No runtime dependency, works offline, consistent voice.
2. **Browser speech synthesis (`speechSynthesis`)** as the fallback for anything without pre-generated audio, such as answers that arrive after reconnection. Voice quality and language support vary by device.
3. **Captions always visible,** with play, pause, replay and speed controls.
If generating audio files is not feasible in the sprint, use speech synthesis everywhere and describe pre-generated audio as the next step. Say so in the README.

## Intent handling (do not hardcode phrases)
- Recognize a small set of command intents: pause, replay, explain differently, try it, quiz me, repeat.
- Anything else the student says or types while at a lesson step is a help request or question about the current step, with their words passed as context to the matcher. Do not require "I don't understand" or any scripted phrase.
- Rule-based now (broad patterns plus fuzzy matching). With a connection, a language model can classify intent more flexibly; offline, a small on-device classifier is the next step.
- Unrelated or off-topic input goes to the honest no-match.

## Tests
- Spoken playback works with the network disabled; captions are always present.
- The demo path has audio (or synthesized speech) for each explanation it plays.
- Intent tests include varied phrasings, and near-misses that must not trigger a command.

## Implemented sprint approach

The reviewed fixed demo has 40 locally generated MP3 narration clips, approximately
1.3 MB total, produced by `npm run generate:audio` using installed Windows SAPI
and FFmpeg. Normal builds consume checked-in clips; regeneration is optional
Windows tooling. No paid service, teacher recording or cloned voice is used.
The generic system voice is consistent across the demo; it is not a custom
student voice model. Voice style and Nigerian-accent suitability still need a
human/device listening check.

The existing schema field is `audioAssetPath` on explanation/activity variants.
Fixed answers, feedback and activity phase captions use an internal exact-text
manifest. All clips are cached in the PWA shell, alongside the single demo
lesson, rather than adding a multimedia transfer schema. The caption text is
the reviewed lesson content; source references remain visible alongside it.
There are no schema changes. Arbitrary future lessons would need a separate
package-publishing design before their audio could be distributed this way.

Narration is enabled once per unlocked session and then responds automatically.
Play/pause/replay/speed controls and captions are always available. Responses
play sequentially, stale speech is cancelled, and microphone input pauses output.
Locking or leaving the player stops narration. If a prepared clip is absent or
fails, only a voice declaring `localService: true` with English language support
is used. No local voice means an honest availability message plus captions.

Only explicit command patterns activate controls; one small substitution or
transposition in a long command word can be corrected. Substrings in questions
do not activate commands. “Pause here” means explain differently; “pause audio”
means pause narration. Replay/repeat restart the current spoken response. Try it
stays at the current step, or reports that no safe prepared activity exists.
Quiz me opens the sourced quiz and reads its prompt/options.

All other input is current-step help context for the unchanged matcher, without
requiring confusion wording. A sourced match is answered without navigating.
No-match context is saved verbatim and accompanied by an unseen related
explanation where one remains. It is explicitly not an answer to that question.
The previous explicit pause/“but I don't understand” form remains a convenience
for requesting an explanation plus supplemental context; it is not required.
