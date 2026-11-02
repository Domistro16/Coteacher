# Source-checking acknowledgement before a delayed answer

The operator heard the explanation after a long silent wait. Source-checking
commentary was already being requested, but the gate required a complete checking
word and rejected common introductions. It also discarded the opening of a
sentence when the progress command arrived halfway through it. Real provider
transcripts can concatenate the next requested utterance without a space.

The gate now accepts bounded prefixes/combinations of known non-instructional
phrases from the first fragment, preserves the sentence prefix, and recovers at
the requested `Hmm,...` utterance when an unknown preface stays muted. Teaching
text remains rejected until the checked result. The pending progress request is
sent after 150 ms rather than 500 ms, with explicit session instructions. Fast
results cancel it. No prerecorded speech or browser TTS replaces GPT-Live.

Validation: the original fragmented acknowledgement failed; the corrected test
passes, including partial words, prefacing speech, concatenation, blocked teaching,
quick-result cancellation and the existing delegation lifecycle. Fifteen live
control/companion cases passed; the final expanded regression also passed.
TypeScript and both builds passed; the student was rebuilt after the last gate
correction. Existing bundle-size advisories remain.

The real GPT-Live WebRTC probe uses a one-shot synthetic microphone and a fixture
backend deliberately delayed ten seconds. Requested commentary was sent about
154 ms after the handler began; decoded audible progress was observed about
1355 ms after it began, before the fixture answer returned. The transcript contains
"Hmm, checking your lesson sources." This is real provider/media evidence, not
human hearing or the full production source-retrieval latency. No school records
were written by the probe. See live-progress-acknowledgement-evidence.json.

Preliminary failures remain recorded: a looping microphone fixture introduced a
second question, and two phrase-list-only corrections still muted the checking
line after natural prefaces. That repeated approach was insufficient. Proposed
AGENTS.md improvement: for live playback-gate changes, test fragmented and
concatenated real-provider utterances before asking the person to reload. AGENTS.md
was not changed in this task.

The local preview serves index-DMK16-ND.js and StudentPlayer-CyBeKSLv.js, verified
byte for byte against the final build. Backend health is HTTP 200; it did not need
restarting because this correction is client-side. Refresh online to receive the
new build. Human hearing of the corrected acknowledgement remains UNVERIFIED.
