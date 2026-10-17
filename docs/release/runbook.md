# Release, deletion and incident runbook

Prepared 12 October 2026. This is a procedure for an authorized operator, not a record of production execution. No deployment/store submission is authorized by the local fixes. Keep the existing backend, database, app identifiers and signing identities.

## Deployment order

1. Snapshot both repositories' dirty states and create a reviewed commit containing the intended changes only. Initial states are in evidence/. Resolve lockfile reproducibility (including Prisma CLI/client mismatch), outstanding logging/cache/label findings, policy facts, moderator staffing and public-policy review. Preserve existing multi-shop migrations and work.
2. Provision an isolated staging database/files/Redis/mail sandbox with synthetic accounts; do not point tests or force-reset commands at the shared Neon URL. Rehearse restore and apply the actual migration chain against a sanitized representative prior schema.
3. Before production migrations, separately authorize deployment, take a verified recoverable backup and record its retention/access settings. New unapplied migrations are20261012120000_release_session_security,20261012121000_private_chat_uploads,20261012122000_account_deletion and20261012123000_chat_safety. The read-only audit shows optional-age and earlier multi-shop migrations already applied. Never run prisma db push/force-reset in production.
4. Apply reviewed migrations with the locked toolchain, then deploy matching backend code. New code references new session/deletion/chat tables; running it against the unmigrated database will fail. Tasks' creator FK changes to nullable/SET NULL to preserve shared work on personal deletion. Existing IDs/password hashes/ownership records survive the local upgrade test.
5. Check JWT_SECRET is present and private; do not rotate it or signing keys as a shortcut. Configure production TLS/proxy/CORS allowlist, database/SMTP/Redis credentials on the server. Verify actual health dependencies rather than treating the existing /api/health response as proof of database/mail health. Production Redis/distributed rate limits and load-balanced revocation must be verified; development memory fallback is insufficient evidence.
6. Deploy support/deletion resources and approved privacy/terms to public HTTPS routes. Verify CSP, no login/geography wall for information, real support delivery, password recovery, ordinary reviewer accounts and external deletion in clean browsers from UK/India. The API never accepts an unauthenticated destructive command: deletion requires a bearer plus password or direct password verification of the requested account.
7. Deploy the monitored deletion processor and moderation operation described below. Test a disposable account through COMPLETE with actual provider evidence; do not mark completion just because the database account disappeared.
8. Build production binaries from the exact reviewed source and environment. EAS production uses remote autoincrement and production services. Confirm the production URL and current remote counters before building. Preserve app IDs/Play App Signing. The owner handles all builds, uploads and submission; this agent is not requesting build or publication access.
9. Install candidates, complete the device/upgrade/permissions/accessibility/network matrix, check privacy network traces and archive/AAB manifests. Capture real screenshots. Review TestFlight/Play pre-launch diagnostics. Fill final store forms and reviewer credentials securely.
10. Only after separate authorization, upload → submit for review → release using the existing listings. Record each observed status and artifact hash; never infer approval/publication from a successful build. Use a controlled rollout when supported and authorized.

## Personal deletion operation

Request paths: mobile Profile → Delete personal account or public About → deletion; website /account-deletion. POST /api/account-deletion/request requires authenticated password confirmation; /request-with-password allows former staff to verify their account without restoring shop permissions; /status uses an opaque 64-character receipt; GET /queue requires an Admin. Requests are durable/idempotent by account type+ID; requesting again rotates a lost receipt. Queued requests are not completed deletions.

Worker (run only for an authorized personal request, against the intended environment):

```sh
node scripts/processAccountDeletion.js JOB_ID --confirm-personal-deletion
```

Stages: REQUESTED → FILES_PENDING → EXTERNAL_REVIEW → COMPLETE. A database transaction locks the job and deletes direct account data, removes memberships/personal chat content, unlinks shared creators and preserves shops/staff/tasks. Failed transactions can retry. File failures leave FILES_PENDING and are retryable; missing files are harmless. Old tokens fail once the account is gone; sockets are disconnected. Do not promote staff automatically. Existing co-owners keep access; ownerless workspaces go to a verified human transfer process that must not indefinitely obstruct personal deletion.

Before processing in production, prevent new writes for the subject and drain in-flight work/sync jobs. Local tests verify old tokens after processing, but **in-flight concurrent writes and distributed jobs have not been fully proven**. Add/validate the deployment-level drain and durable deletion tombstone/restore enforcement before claiming reliable complete deletion. Do not allow restored backups to reopen accounts or reapply erased records.

EXTERNAL_REVIEW is mandatory until an operator has checked personal references in shared free text/photos, reused/legacy files, migration ledgers, Redis caches/OTPs, host/security/mail logs, processors, backup retention and restore erasure. Current worker is not a substitute for these checks. No whole workspace is deleted automatically. Never invent a statutory retention duty for shop records.

Record completed evidence references (not raw personal data/passwords) in a protected JSON file with fields reviewer, sharedRecords, filesAndCaches, mailAndLogs, backupsAndRestoreLedger. Then:

```sh
node scripts/completeAccountDeletion.js JOB_ID protected-evidence.json --confirm-reviewed
```

The command only completes EXTERNAL_REVIEW jobs and requires evidence fields. It cannot independently verify a provider's settings; a human attestation without actual work is not completion. Store evidence outside public source. Monitor oldest request, retry failures and unresolved reviews against the approved7-day implementation target. Timing/notification to users must be truthful; the target is not yet published or verified.

Maintenance tooling:

```sh
node scripts/releaseMaintenance.js
# After separately authorized deployment and local/staging validation:
node scripts/releaseMaintenance.js --apply
```

Default is count-only. Apply removes expired session digests and unattached chat uploads older than24h. It locks upload ownership rows shared with the send endpoint before checking/deleting files, so a newly attached reference cannot race the orphan cleanup. Schedule and failure alerting are not deployed. The script does not implement provider backup/mail/log TTLs or90-day completed-job cleanup; those remain deployment/engineering gates. Legacy untracked uploads need separately validated ownership/reference scanning; do not recursively delete a directory.

## Moderation operation

The separate community acceptance gate has been removed from uploads and messages by owner instruction. Historical acceptance rows do not grant/deny posting. Google Play terms-before-UGC remains a release gap; see moderation-refinement.md. Reports are accepted only for accessible messages. Block/unblock is account-scoped; direct messaging is blocked and group history/summary/realtime content filtered. Directory email exposure reduced. Blocking does not revoke employment or change shop permissions.

An authorized Admin reviews GET /api/chat-safety/reports (oldest first,100 open reports at a time). Resolve through POST /api/chat-safety/reports/REPORT_ID/resolve with action REMOVE or NO_VIOLATION and a concise explanation. Removal hides the content in histories and file delivery and emits message_deleted; report notes and residual files require a defined retention review. Keep admin credentials/session tokens in secure tooling, never docs. No separate moderation UI or vendor filter was fabricated.

Owner must name the person/team, daily queue monitoring and escalation coverage, prohibited-content filtering process, handling for child-safety threats/illegal material and appeals/contact. Do not publish daily-response promises until staffed. Content filtering and full youth-safety operation remain FAIL/BLOCKED despite report/block tests. No global chat access change was made without the owner's decision.

## Incident / rollback

Monitor login/error rates, rejected cross-shop access, deletion queue age, upload failures, moderation backlog, server500/503s, mail failures, app crashes/ANRs and startup performance. Diagnostics must exclude credentials and unnecessary user content; legacy backend logs currently need further redaction. No unverified crash-reporting vendor was added.

If a rollout fails, halt the store rollout and preserve evidence. Revert application code only to a version compatible with the additive schema and current data. Do not roll back by restoring a database snapshot over live changes or resurrecting deleted accounts. Session revocation and deletion ledgers must survive recovery; rehearse restore in isolation, reapply all post-backup erasures, verify ownerships and only then permit traffic. Recover from a failed migration using an reviewed forward repair when possible; nullable task creators cannot safely be reverted after deletion has occurred.

OTA is disabled. Do not use a new OTA switch to conceal functionality or bypass review. Keep the backend compatible with older installed clients during rollout; the legacy /chat-safety/accept endpoint is now a no-op, and acceptance does not block old clients. Preserve existing purchase entitlements if any are discovered in console history; no purchase migration has been verified.

Recheck live official policies, dates, SDK/billing acceptance and account-specific gates at each submission. Store policy approval, successful operation and legal responsibilities remain distinct.
