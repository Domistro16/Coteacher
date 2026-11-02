# School implementation acceptance

Checked on 31 October 2026. **The agreed PC-hosted implementation and acceptance
milestone passes.** The backend and three normal account apps use real Supabase
Auth/PostgreSQL and private R2 with fictional data only.

The user deferred hosted deployment/testing and the separate provider-target
restore drill. Public rollout is not approved by this PC result. Human microphone,
school WebRTC and physical low-end Android behavior remain unverified; real
student mode remains disabled pending the release gates in the setup guide.

Latest PC/provider checkpoint (31 October 2026):

- Supabase PostgreSQL migration, transactional integrity and independent-writer
  serialization passed. Reviewer email sign-in and TOTP enrollment passed.
- Real owner and teacher confirmation emails were delivered and confirmed. The
  fictional school was registered and activated. The teacher's unaffiliated tools
  were denied (403), affiliation was approved and three assignments were created.
- The fictional school-issued student completed initial password change and
  re-login, received JSS2A placement, and enrolled in compulsory Science plus
  optional Art with school approval. A one-subject submission was rejected (400).
- Actual reviewed lesson publication to private R2, authorized streaming, complete
  download, closed-tab offline playback, prepared sourced answer, safe activity
  and quiz, honest unknown-question queue, zero offline API calls, reconnect
  receipt and teacher progress display passed. Browser recording used a synthetic
  tone: it does not establish human microphone intelligibility.
- Sourced teacher guidance returned to the original saved learner question;
  received quiz/question history remained intact. This did not use OpenAI.
- An encrypted populated backup was created at
  `.school-backups/live-populated-tutor-20261031-2053`: four private objects, one school,
  one lesson and learning/tutor records. Restoring this archive to a separate
  empty **local adapter** target verified authorized package access, the original
  audio SHA-256, learning records, three sourced tutor replies and session/upload
  revocation. This is archive
  validation, **not** the required separate provider-target restore drill.
- Real OpenAI typed tutoring returned a sourced answer and contextual follow-up.
  Fresh authorized teacher oversight verified both replies and their sources. Initial requests exceeded the 15-second client deadline; the school
  transport now allows 45 seconds while the demo retains 15 seconds. A 16-second
  delayed-response school browser regression passes without request cancellation.
- Recovery now surfaces managed-issuer failure/throttling instead of falsely
  reporting delivery. A real teacher-origin recovery request was accepted at 21:20 UTC. Inbox delivery,
  reset and successful new-password re-login were confirmed by the user. The
  initial failed sign-in used the usual address instead of the teacher plus alias;
  the exact alias worked. No password was shared in chat.
- All three account frontends are served on the PC with real managed identity,
  private R2 and fictional-data mode. Hosting on Vercel/Render remains deferred.

The earlier zero-object backup remains historical baseline evidence. It does not
represent the populated school or successful restoration.

The sanitized checkpoint is also recorded in
[school-provider-verification.json](school-provider-verification.json). Earlier
provider-access findings below describe the pre-configuration state and are
superseded by this checkpoint; they are not current blockers.

| Requirement | Implementation and evidence |
| --- | --- |
| Separate school application with familiar UI | `apps/school`, its own workspace/build/Vercel manifest, shared brand, typography, cards and illustrations; desktop/mobile browser screenshots below. No query-string portal entry. |
| Registration, class range and reviewed activation | School owner/reviewer UI and server actions; pending-school restrictions covered by `school-registration.test.ts` and `school-portal.spec.ts`. |
| Sessions, class groups and senior streams | School-managed levels, sessions, groups, editable names and subject totals; unit coverage includes SS1 Science/Arts/Commercial and a nine-subject policy. |
| Compulsory and optional subjects | Per-group offerings, automatic compulsory inclusion, min/max enforcement, optional approval, policy review and archival; domain tests and the full school browser journey. |
| Teacher affiliation and multiple assignments | Invitations/approved requests, multiple schools, assignment checks before opening tools and publishing; cross-school and removal tests. |
| Student signup and school placement | Guardian-assisted signup or school-issued credentials, one active school and one placement per session, activation password changes and reset/session revocation tests. |
| Teacher-controlled external sharing | Only the assigned publishing teacher changes the audience; signed-in students without an active school may receive opted-in recordings. Other-school access and withdrawal are tested. |
| Private lesson delivery and learning return | Authorized packages/media/ranges, upload ownership/expiry/checksum/consumption, learner isolation, append-only progress, sourced teacher guidance and durable receipts. |
| Continuous tutoring and offline study | Existing player/tutor interfaces reused. School browser acceptance exercises mock sourced tutoring, complete download, offline reopening and native audio, with zero API calls even when the browser reports online. |
| Managed identity and persistence adapters | Supabase issuer verification/recovery/MFA and secure cookies; PostgreSQL locked transactions, schema/reference validation and browser-role restrictions. Real database migration, locking and rollback pass. Reviewer confirmation, sign-in and TOTP enrollment completed with the real provider; live recovery passed with user-confirmed reset and re-login; real registration/enrollment and offline media return passed. |
| Private object storage and recovery | R2 adapter, encrypted final objects, signed uploads, lifecycle cleanup, encrypted backup/restore. Real encrypted R2 round trip and signed browser upload pass; provider-target restore remains unverified. |
| Hosting configuration | Three Vercel manifests and a same-origin streaming proxy; Render blueprint and Dockerfile. Proxy tests cover request bodies, origins, cookies, byte ranges, body limits and upstream failures. No deployment currently exists. |

Local verification results:

- Generated contracts and TypeScript checks passed.
- Full unit suite: 37 files, 492 tests passed, including deployment-proxy, confirmation-resend, recovery-failure and encrypted signed-upload checks.
- `npm run test:e2e:school`: all three school browser tests passed, including the full
  owner/reviewer/teacher/student journey, delayed mock tutoring, fresh-device
  published insights and confirmation-resend UI.
  Resend is tested with a mocked issuer; this does not establish inbox delivery.
- Final normal builds of school, teacher and student apps passed; account-app
  output is restored after demo verification.
- Demo package pipeline: valid, explicitly simulated.
- Online dependency audit: no known vulnerabilities reported.
- Final complete original-demo browser regression: **45 passed (13.4 minutes)**
  after all fixes, using `COTEACHER_TEST_TUTOR=mock` and isolated demo build output.
  This includes the native 1003 ms chapter-seek regression, full recorded/offline
  replay, actual prepared audio and receipt-backed tutoring/progress paths.
  Microphone/recognition input and the demo tutor remain synthetic/mocked; the
  separate live Supabase/R2/OpenAI evidence above establishes those provider paths.
- Native playback now resolves visual cues at the contract's integer-millisecond
  precision. The deterministic actual-browser test failed before the fix and
  passed after it; genuinely earlier milliseconds retain the previous chapter.
- Final runtime audit: all three PC origins return HTTP 200 and reference their
  normal account build entries; managed identity and fictional-data mode are on.


Screenshots (local mock-provider runs and separately identified real-provider runs):

- [Desktop school portal](screenshots/school/portal-desktop.png)
- [Mobile school portal](screenshots/school/portal-mobile.png)
- [Enrollment approval](screenshots/school/enrollment-approval.png)
- [Downloaded student study offline](screenshots/school/student-offline.png)
- [Real-provider downloaded offline study](screenshots/school/live-student-offline.png)
- [Real-provider teacher learning records](screenshots/school/live-teacher-progress.png)
- [Real-provider teacher oversight of both AI turns](screenshots/school/live-tutor-oversight.png)
- [Local managed sign-in with confirmation resend](screenshots/school/confirmation-resend.png)

Deferred and unverified release checks:

1. Provider-target restore is **deferred by the user** and does not block the
   current PC milestone. It remains unverified for later release: use a separate
   empty PostgreSQL database and private bucket; never overwrite the source.
2. Native human microphone quality and physical low-end Android behavior require
   their own rehearsal. Synthetic browser input cannot establish either.
3. Vercel/Render deployment and hosted-origin acceptance remain deferred by user.

Keep real children's data out of acceptance and deployment rehearsals. The default
configuration keeps real student enrollment disabled. The consent, retention,
recovery and operational review described in the deployment guide remain release
requirements.
