# Voice: input, spoken replies, and intent handling

**Supported scope:** the reviewed demo has prepared spoken clips and matching text.
Voice availability depends on the content and device. New generated answers may
be text-only when no prepared clip, connected speech or installed local voice is
available. Teacher recordings do not have generated captions. Typing and readable
prepared text remain available offline; audio-only use is not guaranteed.

## Input (push-to-talk)
- Press-to-talk capture listens while its button is pressed. Explicitly enabled
  offline voice mode and connected live sessions have separate active-state and
  stop controls; they are not limited to that press gesture.
- Connected speech uses the configured provider after opt-in. The optional local
  browser recognizer is device-dependent; typing is the offline fallback. No
  Whisper/Vosk or other open-source recognizer has been integrated/evaluated.
  Open-source speech and Nigerian-accent evaluation remain future milestones.
- If recognition is low-confidence or unavailable, ask the student to type. Never guess.

## Output (Coteacher speaks back)
Reviewed demo explanations, fixed answers, feedback and Try it instructions have
prepared clips. Other text is spoken only when an available speech path supports
it, with an honest unavailable message otherwise. Use a consistent system voice. Do not imitate or clone the teacher's voice. Mechanism, in order of preference:
1. **Prepared demo clips** generated from reviewed fixed captions with Windows
   SAPI/FFmpeg and checked in as compressed MP3 files. Explanation/activity
   variants use `audioAssetPath`; fixed answers use the exact-text manifest. These
   cached clips need no runtime speech provider. Arbitrary new lesson/answer audio
   is not automatically prepared by this fixed-demo pipeline.
2. **Browser speech synthesis (`speechSynthesis`)** as the fallback for anything without pre-generated audio, such as answers that arrive after reconnection. Only a voice declaring local English support is used for offline fallback.
   Voice quality and language support vary by device; absent local support leaves text readable.
3. **Prepared response text remains visible.** Play, pause, replay and speed
   controls apply to available audio. This does not provide teacher-recording captions.
When a clip is absent and no local speech voice is available, keep the prepared
text readable and show an honest speech-availability message.

## Intent handling (do not hardcode phrases)
- Recognize a small set of command intents: pause, replay, explain differently, try it, quiz me, repeat.
- Anything else the student says or types while at a lesson step is a help request or question about the current step, with their words passed as context to the matcher. Do not require "I don't understand" or any scripted phrase.
- Rule-based now (broad patterns plus fuzzy matching). With a connection, a language model can classify intent more flexibly; offline, a small on-device classifier is the next step.
- Unrelated or off-topic input goes to the honest no-match.

## Tests
- Prepared clip playback works with networking disabled; matching prepared text
  remains visible. Missing local speech must show a readable fallback.
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

## Evaluation limits

No open-source STT or TTS evaluation milestone has been completed. Recognition
control tests use injected browser mocks; native recording uses synthetic audio.
Bundled Windows SAPI clips and actual OpenAI speech requests are distinct from an
open-source speech benchmark. Physical-device recognition, Nigerian-accent quality,
intelligibility and comparative speech memory/latency/cost remain unverified.
Earlier human rehearsal reports apply to their recorded builds, not every current
recording, generated answer or device. See student-learning-acceptance.md.
