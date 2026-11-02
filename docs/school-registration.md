# School registration and student signup

## Applications and journeys

The school portal is its own Vite/React application in `apps/school`. It shares
Coteacher branding, Nunito, purple navigation, cards, illustrations and account
screens with the teacher and student applications. There is no query-string
portal entry. Default builds use account-based workspaces; demo builds are explicit.

Run the delivery service and each development app in separate terminals:

```
npm run delivery:start
npm run dev:school
npm run dev:teacher
npm run dev:student
```

School: `http://127.0.0.1:5175`; teacher: `http://127.0.0.1:5174`; student:
`http://127.0.0.1:5173`. On restricted PowerShell use `npm.cmd`.
Without provider configuration this exercises the same domain services with
fictional local accounts and private local objects. Simulated data is labelled.
It is a test/development adapter, not a substitute for public authentication.

School owners register, select a level range or custom levels, and submit
verification evidence. Platform reviewers activate schools. Pending owners can
prepare classes and subjects; invitations, student issuance and teaching require
activation. Owners can appoint administrators and transfer ownership without
removing the last owner.

The platform reviewer is a separate role from the school's owner. An account on
the reviewer email allowlist opens **School reviews**, with administrative MFA;
it does not register or own schools. Test school registration with a different
adult owner account, then approve it from the reviewer account. Use separate
browser profiles or a private window to keep their local sessions separate.

Supabase's default email sender only confirms project-team email addresses.
Configure custom SMTP before testing signup for other owners, teachers or
guardians outside that team. This setting lives in Supabase Authentication; it
is independent of where the PC apps or future hosted frontends run.

Schools create academic sessions and class groups such as JSS1A/B or SS1 Science,
Arts and Commercial. A school-owned subject catalog feeds each group's compulsory
and optional offerings. Level subject-count defaults copy into new groups and
can be overridden. Minimum and maximum count all subjects; equal values require
an exact count. Rule changes flag approved enrollments for review rather than
silently removing their approved choices. Referenced records are archived.

Teachers request affiliation or accept an invitation. They can belong to several
schools and receive multiple class/subject assignments. Their app opens recording
and preparation only after an assignment check. Draft storage is scoped to the
teacher and offering. Publication rechecks the assignment after upload, validates
the complete recording and requires explicit instructional/privacy review.

Students use school-issued credentials or a guardian-assisted verified email
account. Each verified guardian email currently identifies one learner account;
schools can issue separate credentials for additional learners. Schools approve
affiliation and assign a class. Compulsory subjects are
included automatically; optional selections require approval and must meet the
group's count limits. Students have one active school and one class placement per
academic session. Schools end old affiliation before approving a transfer; old
learning records are retained without exposing them to the new school.

Teachers alone choose whether an approved recording is also shared with signed-in
students who have no active school. Other-school students do not receive that
exception. Removing teacher membership withdraws external sharing. Private media,
packages and progress are authorized on every request; knowing an object ID or
checksum is insufficient.

## Learning and offline behavior

Student packages are generated separately from the reviewed instructional template,
using pseudonymous IDs. No other learner's progress or questions enter a package.
Personalization retains the objective, teacher audio, concept chronology and
source references. This extension uses the existing bounded reviewed-source
lesson tools; it does not claim unrestricted curriculum generation.

Streaming and complete downloads use authorized audio delivery with native byte
ranges. Downloads verify size and SHA-256, then save audio and profile metadata
atomically in the existing encrypted IndexedDB storage. Multiple lessons use
separate profile keys and share compatible encrypted audio without mixing progress.

Complete saved lessons open before account or catalogue requests, including when
`navigator.onLine` is unreliable. A device PIN unlocks local learning; account
expiry does not gate playback. Progress saves locally and returns after a
validated receipt. Teacher replies require lesson source references and return
to the same learner/question. Existing events cannot be rewritten or dropped.
Online events resume optional return; a secondary connection check supports
browsers whose connectivity events are unreliable. Revocation cannot recall a
copy on a disconnected device.

## Authentication, contracts and persistence

Supabase Auth performs adult/guardian signup, verified-email sign-in, recovery and
MFA. The backend revalidates identity with the issuer. Browser sessions use
HTTP-only Secure SameSite cookies through same-origin Vercel proxies. Provider
keys and database/storage credentials remain server-side. School administrators
and reviewers must verify an authenticator before administrative operations.
Email-domain ownership never grants membership automatically.

School-issued student credentials use salted scrypt hashes and durable opaque
session-token hashes. Activation and administrative resets force password change;
changes revoke those sessions. Guardian-managed accounts use verified email
recovery. Repository fixtures and local accounts remain fictional.

`schemas/school-state.schema.json` and generated types cover accounts, identities,
sessions, schools, memberships, invitations, academic setup, assignments,
enrollments, consents, publications, private-object metadata and audit records.
Lesson remote-audio contracts also accept authenticated versioned media URLs.

`POST /api/v1/register`, `/login`, `/logout`, auth recovery/callback/MFA endpoints
and `GET /api/v1/me` serve all three apps. School actions use
`POST /api/v1/school/{action}`. Lesson catalogue, publication, upload tickets,
packages, media ranges, progress and teacher answers use versioned endpoints.
School and actor identity come from persisted ownership and verified sessions.
Demo publication tokens are never accepted by public endpoints.

PostgreSQL transactions lock the school aggregate for approval and membership
changes. The initial aggregate design serializes writes; it favors correctness
for this proof of concept and is not a claim of high write throughput. The table
has row security enabled and public grants revoked; never expose it through a
browser database client. Local file persistence is single-process only.

Cloudflare R2 stores private recordings, reviewed templates and received learning
records. Presigned, short-lived upload tickets are teacher/assignment scoped,
bounded, checksum checked and consumed once. Publication remains invisible until
all required private objects are saved. Browser uploads bypass function body
limits; authorized media responses stream through the backend/proxy.

## Commands and verification

- `npm run build`: account-based student, teacher and school applications.
- `npm run build:demo`: explicit original demo builds plus the school application.
- `npm run dev:demo:teacher` / `dev:demo:student`: original two-profile demo.
- `npm test`: contract, type and unit checks.
- `npm run test:e2e:school`: dedicated multi-user school browser acceptance.
- `npm run test:e2e`: original demo regression suite (separate demo build).
- `npm run verify:school:live`: actual configured Supabase/Postgres/R2 verification;
  missing configuration reports UNVERIFIED and fails the command.
- `npm run school:operator`: provisions a fictional reviewer in local mode only.
- `npm run school:backup -- <folder>` / `school:restore -- <folder>`: encrypted
  metadata/object backup and restore; restoration requires an empty destination
  and revokes restored local sessions. A separate backup encryption key is required.

See [deployment and release checks](school-deployment.md). Automated synthetic
microphone and mock-provider checks do not establish human microphone quality,
real-provider configuration or low-end Android behavior.
