# School deployment and release verification

## Current verification target: hosted on the PC

The user deferred Vercel and Render deployment testing on 31 October 2026.
For the current milestone, run the backend and the three separate frontend apps
on the PC, connected to real Supabase Auth/PostgreSQL and a private Cloudflare R2
bucket. Vercel and Render accounts or projects are not prerequisites for this
milestone. Their deployment instructions below remain for a later hosted release.

Configure the Supabase and R2 values from `.env.example` in the gitignored root
`.env.local`, along with the server storage key, reviewer email allowlist and
the three local app origins. Add each app's `/?auth=callback` URL to Supabase's
redirect allowlist and the teacher origin to R2's upload CORS policy.

Use `npm run delivery:start` for the backend. After `npm run build`, serve each
frontend's built files with its Vite preview and API proxy in separate terminals:

Alternatively, run `npm run local:start` after the build to serve the backend and
all three built apps in one process. Ctrl+C stops all four servers. This launcher
uses loopback HTTP and the fictional-data development mode; it does not weaken
the HTTPS requirements of public mode.

```sh
npm exec --workspace @coteacher/school -- vite preview --host 127.0.0.1 --port 5175 --strictPort
npm exec --workspace @coteacher/teacher -- vite preview --host 127.0.0.1 --port 5174 --strictPort
npm exec --workspace @coteacher/student -- vite preview --host 127.0.0.1 --port 5173 --strictPort
```

The default local origins are `http://127.0.0.1:5175`, `:5174` and `:5173`.
This is fictional-data development verification. Public mode still requires
exact HTTPS origins, encrypted final storage and its existing release gates;
running the server on a PC does not remove those requirements. Managed sign-in
uses Secure cookies, which must be checked with the chosen local browser/origins.
Physical-phone testing over a LAN needs an appropriate secure origin for PWA
and microphone features.

Run `npm run verify:school:live` against Supabase/R2, then the actual registration,
confirmation/recovery/MFA, school approval, assignment/enrollment, upload,
stream/download, offline study and progress-return journeys through the PC apps.

## Later hosted release

The deployment targets are Supabase Auth/PostgreSQL, private Cloudflare R2,
three Vercel frontend projects, and one Render backend. Configuration is included
in the repository. Supabase and R2 are now configured and their database/storage
checks pass; no Vercel or Render deployment currently exists.
Provider verification must remain **UNVERIFIED** until the commands below pass
against actual configured services. All acceptance data must be fictional.

## 1. Supabase

Create a project and configure email signup with confirmation enabled, a working
SMTP sender, and TOTP MFA. Add the exact school, teacher and student callback URLs
(`https://your-app-origin/?auth=callback`) to the redirect allowlist. Use stable
staging origins for staging; do not allow arbitrary preview domains in production.

After correcting the custom SMTP port/login, real owner signup returned HTTP 201.
The user received and confirmed both owner and teacher emails; subsequent live
school registration, approval, affiliation and enrollment succeeded. See
[local SMTP setup](local-smtp-setup.md) for the domain-free temporary testing
option and the later domain-authenticated release requirement.

Copy the project URL, publishable key and PostgreSQL connection string into the
backend environment. Use the direct or session-pooler connection appropriate to
the backend network; keep TLS verification enabled. The database role must own
the Coteacher table so migrations and the backend can operate with row security
enabled. Browser roles receive no access. Never send database credentials or a
Supabase secret/service-role key to frontend JavaScript.

The backend verifies users through [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
Signup, email recovery and MFA use the provider, not demo verification markers.
See [password authentication](https://supabase.com/docs/guides/auth/passwords),
[MFA enrollment](https://supabase.com/docs/reference/javascript/auth-mfa-enroll),
and [database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

Set `COTEACHER_OPERATOR_EMAILS` to the verified adult reviewer addresses. Those
accounts become platform reviewers after verified sign-in and must complete MFA.
Public mode never provisions a default administrator or accepts local adult
credentials. `school:operator` exists only for fictional local acceptance.

## 2. Cloudflare R2

Create a private bucket with public development URLs and public custom-domain
access disabled. Issue a bucket-scoped server token with the object operations
needed by publication, authorized delivery and cleanup. Set endpoint, bucket,
access-key ID and secret only in the backend environment.

Configure bucket CORS for direct teacher uploads. Substitute the actual teacher
origin; do not use a wildcard origin:

```json
[
  {
    "AllowedOrigins": ["https://your-teacher-app-origin"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "content-length"],
    "MaxAgeSeconds": 300
  }
]
```

Uploads use short-lived, one-use application tickets and presigned PUT requests.
The backend checks ownership, current assignment, size, checksum and complete
recording metadata before publication. Final audio, templates, progress and tutor
objects receive application encryption; temporary signed-upload audio is private
raw teacher audio until publication/expiry cleanup. Recordings must already be
reviewed to exclude student voices and private conversations.

Downloads go through authorized backend media routes. The bucket never becomes
a student-facing public catalogue. R2's [S3 SDK guidance](https://developers.cloudflare.com/r2/examples/aws/)
and [presigned URL documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
describe the provider interface used by the adapter.

## 3. Backend on Render

Import `render.yaml` or use the supplied Dockerfile. The process listens on
`0.0.0.0` and Render's `PORT`; `/api/health` is the liveness check.

Configure every required value from `.env.example`:

- `COTEACHER_PUBLIC=true` and `COTEACHER_ALLOW_REAL_STUDENTS=false` initially.
- Supabase URL, publishable key and `COTEACHER_SCHOOL_DATABASE_URL`.
- Private R2 endpoint, bucket and credentials.
- Exact HTTPS `COTEACHER_SCHOOL_URL`, `COTEACHER_TEACHER_URL`, and
  `COTEACHER_STUDENT_URL`, without trailing slashes.
- A stable, high-entropy `COTEACHER_TUTOR_STORAGE_KEY` for private objects and
  tutor envelopes. Render's blueprint generates one; preserve it securely across
  redeployments and restores. Do not rotate it without a data migration.
- Reviewer allowlist. Optional OpenAI settings enable the existing connected
  tutor/live-voice provider; keys remain on the backend.

Public startup fails when required configuration is missing. Legacy demo lesson,
PIN and publisher-token endpoints are unavailable in public mode. Keep a single
backend worker instance for the current tutor-job coordinator; the PostgreSQL
school aggregate serializes approvals and favors correctness over throughput.
Do not claim multi-instance job coordination or high-scale load verification.
See Render's [web service configuration](https://render.com/docs/web-services).

## 4. Frontends on Vercel

Create separate school, teacher and student projects from this repository, each
with the repository root as its project root. Use the corresponding
`apps/{school,teacher,student}/vercel.json` as the local configuration, for example
`vercel --local-config apps/school/vercel.json`. Review a preview before deploying
the production project. The three manifests select their own build commands and
output directories.

Set `COTEACHER_BACKEND_URL` on each Vercel project to the backend's HTTPS origin.
The shared API function proxies same-origin requests and secure cookies to Render.
It streams media and byte-range responses; large recording uploads bypass the
function through private R2 upload tickets. No frontend secret or public bucket
is required. See [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## 5. Verification and operational gates

Run local checks before any public rollout:

```
npm test
npm run test:e2e:school
npm run test:e2e
npm run pipeline -- --lesson fixtures/demo-lesson
```

The school browser suite explicitly uses synthetic microphone input and a mock
tutor. It is not proof of live identity/email delivery, actual provider speech,
human microphone quality or physical low-end Android behavior.

After configuring actual providers, run `npm run verify:school:live`. It verifies
PostgreSQL migration/read and R2 write/read/delete. Supply an existing verified
fictional test account via `COTEACHER_VERIFY_EMAIL`, `COTEACHER_VERIFY_PASSWORD`
and a current `COTEACHER_VERIFY_TOTP` for provider identity/MFA verification. The
script never sends signup email and never logs credentials.

Then verify the deployed UI end to end: email confirmation, MFA, recovery,
pending-school restrictions, school activation, teacher and student invitations,
membership requests, class setup, subject approval, native recording, authorized
upload/stream/download, offline tab close/reopen, shared-device isolation,
reconnect receipts, teacher answers and oversight. Test direct requests with
foreign school/lesson/student IDs and confirm that demo credentials fail.

Keep real student enrollment disabled until the school and operator have approved
the consent process, provider/data-location disclosure, retention duration,
deletion procedure, recovery ownership and incident contacts. Review dependency
audit findings, enforce HTTPS and verify an actual backup restoration. This is an
operational release gate, not a claim that setting a boolean proves compliance.

Backups require a separate 64-hex-character `COTEACHER_BACKUP_KEY`. Run
`npm run school:backup -- .school-backups/<unique-folder>` against configured
storage. The manifest and objects are encrypted; incomplete backups have no
committed manifest. Copy completed archives to controlled backup storage and
preserve both encryption keys separately. The directory is gitignored.

Restore into a separate, empty database and bucket using
`npm run school:restore -- <backup-folder>` with that target's environment.
Keep external providers disabled during the drill. Verify lesson access, audio
checksums and learning records through the target application before considering
the restoration proven. Restored local sessions and pending uploads are revoked.
Supabase identity/SMTP configuration is managed separately and needs its own
provider recovery procedure.

The service cleans consumed/expired upload objects, expired local sessions and
superseded immutable object versions. Version cleanup has a 24-hour grace period;
it does not decide school retention for current learner records. Schedule policy
reviews and authorized deletion separately. Monitor health, authentication errors,
failed publication/receipts, storage failures and backup completion without logging
student questions, credentials, access cookies or provider keys.

Removing affiliation or withdrawing sharing blocks new server access. It cannot
recall copies already saved on disconnected devices. Preserve the local study
path and explain this distribution limit before external publication.
