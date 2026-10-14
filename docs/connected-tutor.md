# Connected tutoring and learner memory

The recorded teacher lesson remains the foundation. Its audio, immutable cues,
approved animations, personalized demo packages and offline cache are unchanged.
Tutoring lives in a contextual companion dock within the recorded player, paused
at the exact timestamp. Desktop reserves a right rail; mobile places the assistant
below the canvas and controls. No dialog, backdrop or focus trap is used. Closing
preserves the paused position; Return to recorded lesson resumes there. Seeking
or starting teacher playback ends the old conversation and releases its microphone.

## Configure and run

Copy `.env.example` to `.env.local` or `.env`, set `OPENAI_API_KEY` on the **server only**, and
restart `npm run delivery:start`. Use the existing teacher and student dev commands.
No key is necessary for approved prepared offline answers or normal recording.
Missing keys produce an unavailable state, never a successful mock AI response.
Existing process variables take precedence, followed by `.env.local`, then `.env`.

Choose **Talk with Coteacher** or **I don't understand**. The dock begins speaking
an approved contextual explanation without a separate Listen click. If tutoring
is already enabled and online, the same help tap saves an explicit request for a
different explanation at that moment; the checked connected answer replaces the
prepared introduction when its MP3 is available. This generated request represents
the help button action, not a fabricated microphone transcript. Unavailable AI
stays pending while approved help remains usable.

In the dock, expand **Voice & connection** and explicitly enable tutoring.
Ask a new question through text or **Ask by voice · connected**. Microphone questions
are limited to 20 seconds; tracks stop before transcription. Review the recognized
text and send it. Local spoken-interruption mode remains browser-dependent; the
Explain button always pauses the exact recording moment without a microphone.

OpenAI Responses (`gpt-4.1-mini`, configurable), transcription
(`gpt-4o-mini-transcribe`) and MP3 speech (`gpt-4o-mini-tts`) use server-side HTTP.
Generated speech is clearly an AI voice, never the classroom teacher's voice.
No unrestricted browsing or autonomous tools are given to the tutor.

## Live avatar voice

Choose **Talk with Coteacher** in the lesson player. This pauses the recording at
its exact moment and begins contextual spoken help in the companion dock. The
microphone button (**Talk by voice** when connected) opens **Voice & connection**.
Explicitly enable tutoring, wait for the server to acknowledge the saved lesson
context, then choose **Start live conversation**. No microphone audio is captured
by opening setup or before consent. Retry also refreshes the existing school
connection state; browser connectivity alone does not acknowledge synchronization.
**Enable offline voice mode** and **Hold to talk offline** use an installed
on-device recognizer only; an unsupported-device message for these controls is
not a GPT-Live failure. Text remains available in either mode.
Offline and connected answers share the same dock, composer, conversation and
concept-specific activity/check. Source and capability labels change; the student
does not leave the player. Confirmation offers a prepared check and does not
declare mastery. More ways to learn contains optional approved representations,
source references, interaction-backed suggestions and saved contextual questions.
GPT-Live (`gpt-live-1`, configurable
independently through `COTEACHER_LIVE_MODEL`) handles connected speech over WebRTC.
Its client delegations use transcript fragments and the same exact lesson moment.
Prepared matches use approved local explanations; new questions use the existing
durable queue, source-checking Responses tutor and observed learner memory.
Checked text is saved and returned before its separate offline MP3 is generated.

The server exchanges the SDP offer with OpenAI; no project key reaches the browser.
Voice output is muted after a learner's new transcript until a checked backend or
prepared/procedural result is returned. GPT-Live paraphrases that result; this does
not verify every spoken word. Device-reported transcript logs reach teacher
oversight through the existing encrypted acknowledged sync. They can include
suppressed speech, may contain recognition mistakes, and are not used as proof of
mastery. Stable log IDs reject rewrites and deduplicate repeated submissions.

End the conversation or close/return from help to stop the microphone immediately.
Activity/check navigation, profile lock/change, offline, page hiding or blur also
stop capture. The connection waits briefly for `session.closed`; a missing final
acknowledgment is honestly reported. Receiver audio energy and the native voice
playhead animate the avatar where browser statistics support them; this is an
approximation, not phoneme alignment. Reduced-motion support remains in use.

Live voice is **online-only**. It is not automatic classroom speech-following and
does not replace the original teacher recording. Use headphones and opt in only
for your question conversation. Audio is sent continuously to OpenAI while on;
`store:false` does not promise zero provider retention. Captured questions and
generated MP3 answers use the existing private learner snapshot. The live stream
itself is not downloaded; prepared clips and returned MP3s remain the offline path.
Only fictional hackathon profiles are supported. Live sessions incur duration
charges, separately from backend reasoning. There is no production billing/quota
service, cross-tab account lock or persistent server-side session manager.

`npm run verify:avatar:live` explicitly tests real model access, WebRTC, client
delegation, a checked Responses answer and native decoded voice. It uses a locally
generated WAV as **simulated learner microphone input**, not as the avatar voice.
It reads the published lesson without changing school records. Start the teacher
dev app first; the probe uses localhost 5174. Physical microphones, speakers and
the complete live student conversation still need device testing.

## Sources and deferral

Only original/alternative approved concept excerpts are passed initially. A tiny
curated NASA SpacePlace lens excerpt is also available for lens/eyeglass questions
at the refraction concept; its title, exact URL, section and excerpt remain in the
reply. This source was inspected on 2026-10-12. No external illustration is copied.
The objective, class level and approved visual annotations constrain the answer.

Structured outputs request a safe, confident, supported answer, exact supporting
quotes and known source/visual IDs. The server verifies those references against
supplied excerpts and concept assets. Unsupported, uncertain, unsafe, refused or
invalidly cited answers stay deferred. This check establishes identifiable sources,
**not guaranteed factual correctness or exhaustive safety detection**. Teachers
inspect the logged responses and can flag them; flagged replies are hidden from
future context and student speech after the next connected refresh. Already
downloaded devices cannot receive a flag while offline.

Approved prepared answers are still matched locally with the existing confidence
threshold. Unmatched questions remain encrypted and durable on-device. No online
answer is disguised as a prepared offline answer. Previously retrieved AI text and
MP3 can be revisited offline but retain their AI/mock origin and oversight status.

## Persistence, jobs and sync

No extra backend is required. `.coteacher-delivery/tutor-<learner-id>.json` stores
PIN-encrypted tutoring state via atomic temporary-file rename, alongside existing
encrypted received progress. One in-process worker per learner consumes persisted queued
question IDs; reopening/synchronizing recovers pending jobs after server restart.
Answered IDs are not regenerated on retry. Failed jobs require an explicit retry;
deferred questions wait for teacher guidance. Requests are bounded to 5/minute and
20/day per profile; no elaborate job broker is used. Only one service process may
own this folder. Storage exhaustion fails without acknowledging success.

The tutor submission uses the existing progress receiver to validate ownership,
immutable context, prefix history and source references. The receipt is checked
against the submitted digest before events are marked synchronized. Newer local
events and playback state are retained when results arrive. ETags avoid repeatedly
downloading unchanged speech during polling. Speech is stored within the learner's
existing encrypted IndexedDB snapshot, not in a public service-worker cache.

Teacher audio remains shared once per device. The new replies do not duplicate or
modify it. Up to 100 question records are retained per active recording; clips are
bounded to 700 KB each. There is no automatic pruning UI yet. Browser storage can
be evicted; transfer/recollection remains necessary on affected devices.

## Memory and recommendations

Memory uses actual received demo interactions with stable event IDs, independently
for A and B. It records quiz correctness, explanation requests, questions and
explicit visual selections. The API receives recent observations without learner
name, PIN or raw event IDs and same-concept conversational history. This lets the
model adapt its explanation to observed needs. The model is **not retrained**.

Recommendations are simple, inspectable rules: a learner's explicit representation
choice suggests that approved visual again; otherwise an incorrect concept check
suggests a concrete approved representation. No evidence means no extra recommendation.
Each recommendation includes contributing event IDs and stays within the shared
objective. These clickable suggestions are available offline after retrieval.
The original package's predetermined A/B visual sequences still retain their
simulation label; they are not claimed to be learned from these new events.
Automatic regenerated future-lesson packages and cross-lesson memory are deferred.

## Privacy and deployment limits

Only supplied fictional profiles are supported. Their public demo PINs provide
functional encrypted storage separation, **not production authentication**. The
loopback server and teacher proxy token are a local hackathon trust boundary.
No real children's data should be entered. Questions can contain personal data;
connected tutoring sends question text, source excerpts, recent conversational
context and observation details to OpenAI; connected voice sends microphone audio.
Source metadata may contain teacher names. `store:false` does not promise zero
provider retention. Real-school deployment needs identity/access controls, consent,
retention/deletion controls and an appropriate OpenAI data policy before using
identifiable child information. Cloud media distribution remains unconfigured.

## Verification commands

`npm run test`, `npm run build`, `npm run pipeline -- --lesson fixtures/demo-lesson`.
For the explicitly mocked browser journey in PowerShell:

```
$env:COTEACHER_TEST_TUTOR='mock'
npm exec -- playwright test tests/e2e/tutor.spec.ts
Remove-Item Env:COTEACHER_TEST_TUTOR
```

The mock provider exists only in test fixtures and reuses prepared spoken clips.
It never starts in `delivery/start.ts`. This verifies storage/voice transport/player
behaviour, not actual model reasoning, transcription accuracy or generated speech.
Live verification requires a separately configured key and a new unmatched question;
inspect `engine:openai`, real request success, sources and audible generated MP3.
`npm run verify:tutor:live` is an explicit, potentially billable probe against an
already published teacher recording. Without a key it exits UNVERIFIED and makes
no API requests. It reads published materials and saves a separate MP3 under
`.task-tmp/live-tutor-probe.mp3`; it never modifies school progress or question
records. Listen to that clip and inspect the cited answer. The live student journey
and connected microphone/transcription still need a separate browser test.
