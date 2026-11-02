# Student learning extension operations

This PC implementation uses fictional learners only. The two-lesson acceptance
uses the original light/refraction lesson and an explicitly reviewed follow-on
lesson that revisits the same objective. It does not demonstrate general curriculum
authoring or improved educational outcomes.

The student library offers **My learning preferences**; four short screens preserve
drafts. Profile/settings allow optional answers to be removed, personalization to
be disabled and authorization withdrawn. Schools retain control of placement and
subject enrollment; a preference change request grants no access. School Settings
contains independent guardian reviews and placement-request triage. Teachers use
Published lessons to prepare/review reusable support and explicit concept mappings.

For the current PC, `npm.cmd run build` creates the three account apps and
`npm.cmd run local:start` serves student on `http://127.0.0.1:5173`, teacher on
`http://127.0.0.1:5174` and school on `http://127.0.0.1:5175`, with the configured
backend on 8787. Earlier PC checks used this launcher. Current availability is not asserted by
Batch 1; its tests use separate fictional services without private env files.
When running previews yourself, keep the launcher alive; Ctrl+C stops it. An anonymous public-config/bundle check does not verify account sign-in.

Default consent delivery is a labelled simulated link, not mailbox proof. An
implemented Resend adapter can be explicitly configured with
`COTEACHER_GUARDIAN_MAIL_MODE=resend`, `COTEACHER_GUARDIAN_MAIL_KEY` and a verified
sender in `COTEACHER_GUARDIAN_MAIL_FROM`; it requires the exact HTTPS
`COTEACHER_STUDENT_URL`. No real email was sent during acceptance. A provider's
acceptance response is not inbox delivery confirmation. Failed delivery withdraws
the pending token. Real-child collection remains disabled independently of email
configuration. See [Resend send API](https://resend.com/docs/api-reference/emails/send-email).

Keep `COTEACHER_TUTOR_STORAGE_KEY` stable: private profiles/memory derive a distinct
purpose-bound key from it. Backups contain their encrypted envelopes. Do not rotate
this key without migrating/restoring private records. Existing account metadata and
PIN lesson transfers remain separate. Withdrawal clears optional server records and
involved devices on next participation; disconnected copies and historical backups
cannot be instantaneously erased.

`COTEACHER_TEXT_PROVIDER` selects `openai` (existing default), `llama.cpp`, or `none`.
Local selection additionally requires an explicit `COTEACHER_LOCAL_MODEL`, loopback
`COTEACHER_LOCAL_MODEL_URL` and `COTEACHER_LOCAL_MODEL_APPROVED=true`. There is no
automatic fallback to an external provider. Local speech/transcription are
unavailable; prepared offline audio/text remain available. The evaluated Qwen
0.6B model was **rejected**, so do not approve it for learners. Runtime/model files
are in ignored `.task-tmp/local-model`, with checked SHA-256 provenance and licence.
The benchmark process was stopped after measurement. See
[benchmark evidence](local-model-benchmark.json),
[llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
and [official Qwen model](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF).

Knowledge-tracing libraries, server vector retrieval and browser embeddings remain
evaluations for a broader corpus. Transparent rules and the conservative matcher
are the current baseline. There is no pooled training, automatic retraining, neural
knowledge tracing or measured cost-saving percentage.

## Real-child release gate

Legal and operational signoff remains deferred. Official NDPC Act and GAID URLs
were checked again on 1 November 2026 and returned HTTP 403; no complete legal
review or compliance conclusion is claimed. Release review must resolve lawful
basis/guardian authority and verification, optional profiling, age assurances,
clear notices, retention/deletion (including backups/disconnected devices), rights
handling, provider/email disclosures and international transfers, operational
reviewer training, and security/incident procedures under the applicable current
rules. Do not treat mailbox control plus staff review as automatic compliance.

Official references: [Act landing page](https://ndpc.gov.ng/download/nigeria-data-protection-act-2023/),
[GAID PDF](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf).
Hosted deployment/provider-target restore remain deferred. Physical Android,
human microphone and offline voice recognition require separate device testing.
