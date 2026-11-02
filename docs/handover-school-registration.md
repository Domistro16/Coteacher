# Coteacher school registration handover

Prepared on 31 October 2026 for the next chat. Workspace: `D:\Coteacher`, Windows PowerShell. This document records the latest session state; some earlier acceptance records are older than the live progress described here.

## Latest checkpoint: PC milestone complete (31 October 2026, 22:41 UTC)

This block is authoritative. The later sections preserve the original handover
history and its superseded blockers; do not restart their completed work.

The agreed PC-hosted school-registration/student-signup milestone is complete.
The user explicitly deferred Vercel/Render deployment/testing and the separate
provider-target restore drill. Public rollout is not approved by this PC result:
human microphone, school WebRTC and physical low-end Android checks remain
unverified, and real student mode remains disabled.

- All three normal account apps are running on 127.0.0.1 ports 5175 (school), 5174
  (teacher) and 5173 (student). The final audit confirmed HTTP 200, matching normal
  build entries, managed identity and simulated-data mode. The local backend is
  still running; do not reuse stale test/server process handles from the history.
- Real provider acceptance passed: owner/teacher confirmation, administrative MFA,
  school activation, unaffiliated teacher denial, approved membership and three
  assignments, school-issued student credentials and forced password change,
  placement, compulsory/optional enrollment and minimum-subject rejection.
- Actual private R2 publication/stream/download, closed-tab offline playback,
  prepared sourced help, safe activity/quiz, honest no-match, zero offline API
  calls, receipt, teacher insight and sourced teacher guidance passed.
- Actual OpenAI typed answer and contextual follow-up passed with checked excerpt
  references. A fresh assigned-teacher UI read verified both replies and sources.
  No school WebRTC or physical microphone proof is claimed.
- Recovery passed: the user reset the teacher password, initially tried the usual
  email, then successfully signed in using the exact teacher plus alias. The
  provider account is confirmed. No new password or recovery token was shared.
- Fixes include truthful recovery failure/rate-limit reporting, a 45-second school
  tutor deadline (original demo stays 15 seconds), and native player clock
  normalization to integer milliseconds. Chromium can report 1003 ms as 1002.999
  ms; this previously restored the earlier chapter. The deterministic browser
  regression failed before and passed after the fix, including the prior-ms check.
- Final validation: 37 unit files / 492 tests; generated contracts and TypeScript;
  all three normal builds; three school browser tests after the clock fix; and a
  **single complete 45-pass demo browser run (13.4 minutes)** after all changes.
  Demo package validation passed. Browser microphone/recognition and demo tutor
  input are synthetic/mocked; live provider evidence is recorded separately.
- Demo regressions used `.task-tmp/e2e-demo` through `COTEACHER_E2E_BUILD_ROOT`, so
  the normal PC account apps remained available. Label/audio sampling checks now
  observe completed frames and actual decoded speech with unchanged thresholds.
- Populated encrypted backup: `.school-backups/live-populated-tutor-20261031-2053`,
  created `2026-10-31T20:53:04.249Z`, four objects. A separate empty local adapter
  restore verified audio SHA-256, authorized packages, learning history, three
  sourced tutor replies and local session/upload revocation. This is **not** a
  provider-target drill. The source database/bucket were never cleared/overwritten.
- `.env.local` remains private and configured for the populated source, not a
  restore target. Preserve storage/backup keys and private fixtures. The teacher
  fixture may still hold its old password after the manual reset: do not retry it
  repeatedly or ask for the new password in chat. Future automation needs a local,
  privately updated fixture or a valid signed-in session.
- Acceptance and requirement evidence: `docs/school-acceptance.md` and
  `docs/school-provider-verification.json`. No commit was made. Existing user work
  and private fixtures were preserved. No VM cleanup was performed.

## Historical goal and completion status (original handover)

The active goal is:

> Complete the agreed public-launch school registration and student signup implementation: separate school app matching teacher/student UI, Supabase authentication/PostgreSQL, R2 storage, school-authorized teacher/student lesson journeys, deployment configuration, and acceptance verification.

**The goal is incomplete and remains active.** The user wants this finished before moving to other work. The user requested this handover; do not interpret that as completion or an instruction to pause the goal.

**Current hosting scope:** the user explicitly deferred Vercel/Render deployment and deployment testing. Run the backend and serve all three built frontends on this PC, connected to real Supabase and private Cloudflare R2. Hosting configuration exists for later. Do not make hosted deployment or buying a domain a blocker for the PC milestone.

## Agreed product behavior

- A separate school app, not `/?portal=school`, with the same visual language and interaction conventions as the teacher/student apps.
- School registration and operator review before activation. Owners/admins manage school people, academic sessions, class levels, groups/streams, subjects and assignments.
- Schools choose their supported range: Primary, JSS and/or senior secondary. Schools can create groups such as JSS1A/JSS1B and SS1 Science/Arts/Commercial.
- Subjects can be compulsory or optional. Each class/group has school-defined enrollment minimum/maximum; a school can require exactly nine subjects at the appropriate stage.
- A teacher can belong to multiple schools and teach multiple subjects across multiple classes. An unaffiliated teacher cannot use core teaching/recording tools. Assignment and school authorization govern access.
- Students need approved affiliation, placement and enrollment for school content. Compulsory subjects are automatic; optional selections require school approval. Invitations and approved join requests are supported.
- School-issued student credentials do not require a child's email; guardian-assisted verified email is another supported route. One active school and one placement per session for a student.
- A teacher may explicitly approve reviewed recording sharing with signed-in students who have no school. This must not grant access to students at another school.
- Downloaded student lessons work offline, including reopening. Questions, explanations, quizzes and activities retain source references; the matcher honestly returns no-match. Activities use safe household items. Personalization changes the route, not the objective.
- Use fictional/simulated acceptance learners only. No real children's data.

## Read first and protect existing work

Follow the user's `AGENTS.md` instructions. Read `docs/product-brief.md`, then the relevant architecture, scope, contracts, safety, demo-acceptance and hackathon-experience rules before changing the experience. Schemas first, generated types second, implementation third. Use small vertical tasks with acceptance criteria and meaningful tests.

The working tree contains extensive modified and untracked implementation files. **Do not reset, clean, delete or overwrite them.** Some live tutoring work predates this school task, especially student `App`/`StudentPlayer`/live voice/connected tutor, delivery live-provider/server/tutor-store, and human/live evidence documents. Preserve it. Do not create `PROMPTS.md` or commit secrets. No commit was made as part of this handover.

The user briefly requested VM cleanup, immediately cancelled it, and nothing was deleted. There is no standing cleanup request. Do not spawn subagents unless the user or applicable instructions explicitly request them.

## Implementation already present

### Apps and account journeys

- `apps/school/`: independent Vite/React school portal; Nunito/purple navigation, shared branding, desktop/sidebar and mobile navigation. Owner/admin/reviewer workflows, people, groups, subjects, enrollment and settings.
- `apps/shared/AccountGate.tsx` and account API: signup, login, callback, recovery, MFA, role navigation and mandatory initial password change for school-issued credentials.
- Teacher `SchoolTeacher`, `SchoolPublications`, `SchoolQuestions`: affiliation/assignment gates, scoped class/subject selection and lesson drafts, publication audience, questions, progress and tutor oversight integrated with the existing teacher app.
- Student `SchoolStudent`: authorized library, placement/enrollment, pseudonymous per-lesson encrypted cache, device PIN, streaming/downloads and receipt-based progress. Reuses the existing player. Local-first reopening must work even when `navigator.onLine` is true but the service is unreachable.
- Normal builds now produce account apps. The original two-profile demo remains available through explicit `build:demo` and `dev:demo:*` scripts.

### Backend and persistence

- `delivery/school-store.ts`, `school-integrity.ts`: transactional memberships, school lifecycle, assignments, placement/enrollment limits, owner safeguards, archive cascades, content permissions and append-only progress rules.
- `school-postgres.ts`: JSONB aggregate at `coteacher_school_state`, row `id=1`, locked with `SELECT FOR UPDATE`; contract/integrity validation, RLS, and no direct PUBLIC/anon/authenticated access.
- `managed-auth.ts`: Supabase issuer validation, HTTPOnly Secure `__Host-coteacher_auth` cookie, administrator MFA.
- `school-http.ts`: origin/CSRF, JSON/size/rate checks; managed adult identity in public mode and school-issued student sessions.
- `private-storage.ts`: local/R2 adapters and AES-256-GCM `COT2` envelopes with object-key AAD. Temporary signed `uploads/` audio remains raw; final private objects are encrypted.
- `school-lessons.ts`: signed expiring one-use upload tickets, checksum/length checks, assignment rechecks, reviewed source-bound publication, authorized per-student packages, media ranges, progress and teacher answers.
- `school-tutor.ts` and server-envelope encryption connect authorization to existing tutor/live tools, consent and teacher oversight.
- Backup/restore CLI, encrypted manifests/checksums, empty-target restore requirement, and maintenance/session/ticket cleanup exist.
- Supabase/PostgreSQL, S3 SDK and deployment dependencies/configs are present. Docker, Render and per-app Vercel configuration are prepared; live hosting tests are deferred.

### Latest code changes to remember

1. Login now identifies Supabase `email_not_confirmed` and gives an actionable confirmation message. Login email is normalized. A guarded/rate-limited resend endpoint and email-only resend button were added; it does not silently send or fake success.
2. `delivery/server.ts` and `school-backup-cli.ts` select `EncryptedPrivateStorage` when public mode is enabled **or R2 is configured**. Therefore real R2 is encrypted even in the PC-hosted configuration. `docs/contracts.md` documents the stable key requirement. Local filesystem-only simulated adapters are unchanged.
3. At the point encryption selection changed, no lesson/tutor objects existed. Subsequent media attempts may have created objects; their current state has not been verified. Do not assume the bucket is still empty or delete it.

## Configuration: present, private, and already working

`.env.local` exists and is gitignored. It contains real Supabase URL/publishable key/PostgreSQL connection, private R2 endpoint/bucket/object credentials, stable tutor-storage encryption key, separate backup key, loopback app URLs and the adult reviewer allowlist. Public mode and real-student use are disabled. Existing OpenAI settings remain in `.env` as fallback. Do not print either file or copy values into documentation/chat.

Supabase callbacks are configured for `http://127.0.0.1:5175/?auth=callback`, port 5174 and port 5173. Chromium actually stored and sent the Secure HttpOnly cookie over loopback HTTP. Filtering cookies by an HTTP URL alone misleadingly hid it; do not reintroduce an HTTPS blocker for the demonstrated loopback setup. Public HTTPS and LAN access are separate concerns.

R2 CORS was configured through the dashboard by the user. The object token could not manage bucket CORS (403), but actual browser preflight and signed upload subsequently passed. Do not request new infrastructure merely because the token cannot edit CORS.

Custom Brevo SMTP now works. Host `smtp-relay.brevo.com`, port **587**, exact Brevo SMTP Login and SMTP key are required. The earlier supplied port 575 and username `coteacher` were incorrect. The user owns no domain and used a verified adult sender address. The dashboard's default DKIM warning is not the same as a failed sender verification. Real owner and teacher confirmation emails were delivered and confirmed. Never ask for mail passwords or keys in chat.

## Verified evidence, with limits

### Automated checks

- Latest `npm.cmd test`: **37 files / 489 tests passed**, after the R2 encryption selection change. This command also checks generated contracts and TypeScript. The last run took about 309 seconds.
- `npm.cmd run test:e2e:school`: **3 passed**, after the confirmation/resend UI fix and before the latest backend encryption selection change. All three normal account builds were restored afterward.
- Original browser suite: **44 passed** with `COTEACHER_TEST_TUTOR=mock` at an earlier checkpoint. It was not rerun after the latest auth/encryption changes; do not imply otherwise.
- Demo package validation passed at an earlier checkpoint. Last online dependency audit reported zero known vulnerabilities; dependencies have not changed since that check.
- Mock issuer/email tests verify application behavior, not mailbox delivery. Separate live evidence below proves actual delivery.

### Real providers and browser interactions

- Real PostgreSQL schema migration and transactional read passed. Separate connections demonstrated writer serialization; a rolled-back JSONB probe left no persistent change.
- Real R2 encrypted verification-object write/read/delete passed.
- Real signed browser PUT from the teacher origin returned 200, retrieved bytes matched, and the temporary verification object was deleted. Preflight returned 204. This was a protocol test, not human audio evidence.
- Adult reviewer confirmed email and signed in. The operator identity is linked in PostgreSQL. The user completed authenticator setup; a read-only check found one verified TOTP factor. No reviewer seed/code was exported.
- Encrypted baseline backup exists at `.school-backups/live-baseline-20261031-114205`, created `2026-10-31T10:42:29.248Z`, **zero objects**. It captures the earlier reviewer-only state, not current school/media state or a successful restore.
- A fictional owner signed up through the actual UI (201), confirmed email, signed in and enrolled a test authenticator.
- **Fictional Live Provider Academy** was registered through the UI, then the user approved it as reviewer. Its status was verified active.
- Session 2026/2027 and groups were created: JSS2A minimum/maximum 2; SS1 Science, Arts and Commercial each minimum/maximum 9. JSS2A Science is compulsory and Art optional. SS1 Science has a Science offering.
- The teacher signed up with a user-controlled Gmail alias, and the user confirmed its email. Before affiliation the recording UI was unavailable and direct teaching access returned 403.
- The teacher requested membership; the owner approved it. Three assignments were added: JSS2A Science, JSS2A Art and SS1 Science Science.
- The owner issued a fictional student's credentials without a child email. The student actually completed enforced initial password change and re-login, and was placed in JSS2A.
- Science was compulsory/automatically selected. An actual submission of only Science returned 400 for minimum two. The student selected Art and the owner approved the two-subject enrollment through the UI.
- The enrollment helper reported PASS for affiliation, unaffiliated denial, three assignments, school-issued credentials, forced password change, compulsory/optional enrollment and minimum-subject enforcement.

Latest live screenshots include `docs/screenshots/school/live-pending-school.png` and `live-enrollment-approved.png`, plus earlier portal/auth screenshots. Earlier `student-offline.png` is not proof of the unfinished current real-provider media journey. Do not claim live offline/progress screenshots without verifying them.

**Stale records:** `docs/school-provider-verification.json` still has pending email/multi-user fields from before the latest owner/teacher confirmation and enrollment work. `docs/school-acceptance.md` also predates these checkpoints. Reconcile these records later using the distinctions above; do not overwrite historical scope or label media/recovery/restore as passed.

## Exact stopping point and blocker

The real media publication → student stream/download → offline reopening → progress receipt → teacher insight journey is **not verified**.

Private helper `.task-tmp/provider-acceptance/media.mjs` attempted the actual recording/publish flow. The first run failed with sanitized stage `review-and-publish-to-r2` and `name: Error`. A second run added finer stage/error logging, but its result was lost when the process/tool session disappeared. There is no definitive second error message and no `.task-tmp/provider-acceptance/media-result.json` at handover. Do not assert that publishing succeeded or that a specific R2 bug has been identified.

An escalated read of PostgreSQL publication/upload/retired-object counts was **not executed** because automatic approval review hit the account usage limit. The review tool said to purchase credits/upgrade or try again at **4:57 PM**. This was a review failure, **not a determination that the query was unsafe**. Do not bypass it by rerouting that same rejected provider query through the app or another tool. Resume the blocked external diagnostic only when approval is available or the user provides appropriate guidance. Unaffected local inspection/tests can continue.

Network requests to the real providers have needed `sandbox_permissions: require_escalated`; default attempts produced EACCES. Existing prior approvals do not make a failed automatic review an executed action.

**All three local apps are stopped.** At handover, HTTP checks on 127.0.0.1 ports 5173/5174/5175 all failed. Old server handle 4995 and media test handle 64811 are stale; the latter explicitly returned unknown process ID. Do not keep polling them or report them running.

## Private acceptance fixtures: preserve, never expose

The gitignored directory `.task-tmp/provider-acceptance/` contains:

- `owner.json`: adult test identity/password, school ID/name and the fictional owner's test TOTP seed.
- `teacher.json`: adult test alias and password.
- `student.json`: fictional issued account credentials, changed-password state and device PIN.
- `owner-browser.json`, `teacher-browser.json`, `student-browser.json`: saved authentication cookies/tokens; student storage may include encrypted IndexedDB learning data.
- `session.mjs`, `owner-setup.mjs`, `enrollment.mjs`, `media.mjs`: helpers reading those files, without embedded credentials.

Never print, commit or copy credential/browser-state files into the handover. Preserve them for resuming existing accounts and progress. Do not ask the user to reconfirm already-confirmed emails or approve the already-active school.

Helper cautions:

- `owner-setup.mjs` still asserts pending status, so do not blindly rerun after approval.
- `session.mjs` restores saved browser state or signs in. `saveActor` includes IndexedDB only for the student. Teacher synthetic recording drafts are lost on context closure.
- A cached student lesson may open a legitimate local PIN gate before network auth. The helper's sign-in/navigation wait may need to recognize it. Do not erase cache or force network as a workaround.
- Preserve student progress history; deleting browser state can create append-only conflicts or destroy the offline proof.
- `media.mjs` uses synthetic 440 Hz input with real browser recorder/Opus processing. It cannot prove microphone intelligibility, a human recording or a physical Android test.
- It skips recording when the lesson catalog is nonempty. Inspect actual publication state once provider review is available before rerunning, to avoid duplicates.
- Next run should persist sanitized stage/failure evidence to a local file before closing, so losing a tool handle does not lose diagnosis. Do not save presigned URLs, auth headers, QR codes or secrets in logs/traces.

## Next work, in order

1. Read this handover and the required project docs. Inspect the current diff without reverting it. Confirm local health and the approval/usage situation.
2. Inspect the media helper and publication path locally. A useful independent regression test would exercise the signed-upload path with a local backing adapter wrapped by `EncryptedPrivateStorage`: create a real ticket/hash, place raw bytes at the temporary upload key, publish with upload ID, retrieve authorized student package/audio, verify final raw objects have COT2 envelopes and ticket reuse fails. This test is **proposed, not written**, and cannot itself establish live R2 success.
3. When provider approval is available, diagnose the failed publication using durable sanitized output and actual state. `EncryptedPrivateStorage.uploadUrl` forwarding and raw `uploads/` passthrough already exist; do not assume either is missing. Distinguish UI selector/helper failures from server/storage failures.
4. Restart PC apps with `npm.cmd run local:start` after any required build. Complete actual signed audio upload, reviewed publication, authorized student playback/download, closed-tab offline reopening with no API calls, sourced prepared answers, safe activity/quiz, honest unknown-question queue, reconnect receipt and teacher progress display.
5. Verify school-connected tutor/teacher answer return and scoped oversight with actual configured providers and consent. The media helper does not currently establish real OpenAI school tutoring. Do not treat mocked tutor tests as live provider proof.
6. Verify real account recovery; it has not been exercised live.
7. Create a populated encrypted backup and prove restore into a **separate empty target**. Never clear/overwrite the source. A dedicated restore target/configuration has not been created; the zero-object baseline is not a populated backup or restore proof. Do not silently substitute a weaker namespace test and claim equivalent verification.
8. Update acceptance/provider evidence and screenshots accurately; run checks appropriate to new changes. Keep Vercel/Render tests deferred as requested. Human audio, physical-device and future public-release limitations must remain explicit. Do not mark the full goal complete while required work remains.

## Commands and navigation

Use `npm.cmd` in PowerShell when script execution policy blocks `npm`.

```powershell
npm.cmd run build
npm.cmd run local:start
# School:  http://127.0.0.1:5175
# Teacher: http://127.0.0.1:5174
# Student: http://127.0.0.1:5173
# Backend: port 8787, proxied by the apps

npm.cmd test
npm.cmd run test:e2e:school
# Original demo browser suite, with the documented mock provider setup:
npm.cmd run test:e2e

# Existing private live helpers; inspect prerequisites before running:
node --import tsx .task-tmp/provider-acceptance/enrollment.mjs
node --import tsx .task-tmp/provider-acceptance/media.mjs
```

`local:start` serves built account frontends and starts the backend in one process, loads `.env.local` then `.env`, binds loopback and shuts down its children together. `test:e2e` builds demo-mode student/teacher assets; restore normal `npm.cmd run build` before serving account apps afterward.

Other useful entry points: `docs/school-registration.md`, `docs/school-deployment.md`, `docs/school-acceptance.md`, `docs/contracts.md`, `docs/local-smtp-setup.md`, `tests/school-lessons.test.ts`, `tests/private-storage.test.ts`, `tests/school-fixture.ts`, and `tests/e2e/README.md`.

## Suggested opening message for the next chat

> Read `docs/handover-school-registration.md` and the required AGENTS.md documents in `D:\Coteacher`, then continue the active school registration/student signup goal. Preserve the existing implementation and private fixtures. The immediate unfinished task is diagnosing the real-provider media publication and completing the authorized offline student/progress journey. Email confirmation, school approval and enrollment already passed. Vercel/Render are deferred; use the PC apps. Respect the recorded automatic-approval usage blocker and do not bypass the rejected provider diagnostic.
