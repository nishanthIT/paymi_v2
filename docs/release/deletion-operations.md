# Deletion operation and recovery evidence

13 October2026. Targets7days/30days/24hours/90days are approved implementation targets, not verified deployed retention promises. No production account or customer data was deleted in this work.

## Actual service coverage

| Data/service | Actual observed mechanism | Implemented deletion/recovery | Missing operating evidence |
| --- | --- | --- | --- |
| Authentication | Own bcrypt accounts in Neon PostgreSQL,7day JWT, no social-provider login found | Durable PROCESSING barrier rejects old sessions before erasure; password confirmation; per-role identity; socket disconnect; absent account cannot sync | Deployed all-node revocation and complete write/job drain |
| Account, memberships and personal content | Prisma/PostgreSQL and local uploads | Serialized retryable erasure; preserves shop/staff/co-owner/tasks; removes own direct records/files and anonymizes author links | Personal references in shared free text/photos, legacy migration evidence and ambiguous files need individual review |
| Redis/OTP/current cache | Existing ioredis plus development memory fallback; OTP10min in code | Direct provider DEL/EXISTS for account OTP/cooldown and typed online/socket keys; provider errors propagate, production refuses disconnected fallback; current worker memory keys also cleared | Actual Redis persistence/TTL, old cached data, multiple application processes and restored persistence |
| Chat report evidence | Private filesystem and ContentReport snapshot, moderation action records | Admin-only access; not public uploads; reporter identity unlinked on deletion; case evidence remains in mandatory review | Agreed justified evidence retention, actual deletion/anonymization of case content and private evidence backups |
| Local uploaded files | Server filesystem, ownership registry | Retryable own tracked-file removal, avoids deleting another member's references; orphan maintenance target24h | Host/storage replication, untracked legacy files, filesystem backup expiry and actual scheduler |
| Mail | Zoho SMTP plus legacy expiry-mail service | Local OTP records erased; no provider mailbox deletion API/retention setting was supplied | Provider message/log retention, actual recipient/mailbox support process and deletion confirmation |
| Host/security/diagnostic logs | Existing host/proxy/application logs | Admin auth no longer logs tokens/cookies/user data; new queue monitor emits counts only | Full redaction audit, actual host log retention/access/processor settings |
| Neon/host/local backups | Provider and existing private backup files, exact windows unknown | Signed minimal identity ledger, pre-erasure journal gate, traffic-disabled replay and sequence advancement tested against a real synthetic pg_dump/pg_restore | Actual Neon restore window, protected independent ledger storage, backup expiry/access controls, full provider restore drill |
| Device caches/label drafts | Scoped query caches; device-local label storage | Typed role/account/shop label keys; ambiguous old keys preserved without automatic import; offline expiry/identity checks; logout tombstone | Real-device upgrade/recovery and deletion of residual data on other devices; legacy draft ownership verification |
| Minimal deletion evidence | AccountDeletionJob and protected ledger files | No raw bearer/password in ledger; integrity checks; receipt hashed |90day cleanup cannot be asserted until backup expiry/ledger lifecycle are verified; schedule remains BLOCKED |
| Analytics, ads, push, third-party identity/AI | None established as an active processor in the inspected release path | No invented processor deletion integration | Final native/network observation still needed; reassess if actual traffic/SDK settings reveal another service |

## Worker and completion

States: REQUESTED→PROCESSING→FILES_PENDING→EXTERNAL_REVIEW→COMPLETE. The PROCESSING barrier is committed before erasure; provider/journal/DB failure leaves the account blocked and the job retryable. Same-message/upload writes use an account row lock and check the barrier so late chat writes cannot recreate personal content. This does not establish a drain for every legacy controller/background job: validate all producers before production processing. Shared workspace deletion remains a separate authorized operation.

Production requires an absolute private **DELETION_LEDGER_DIR** on an independently protected recovery store and a private **DELETION_LEDGER_KEY** (at least32characters) in the host's secret manager, never ordinary chat/source. The worker writes/fsyncs an integrity-protected ledger before erasure and refuses production erasure if journaling or Redis is unavailable. Verifying the backing mount/replication/access/retention is an operator task; a local fsync alone does not prove independent backup protection.

Commands below are prepared, not run against production:

```sh
node scripts/processDeletionQueue.js            # count/describe pending work only
node scripts/processDeletionQueue.js --apply    # only after deployment authorization
node scripts/processAccountDeletion.js JOB_ID --confirm-personal-deletion
node scripts/releaseQueueHealth.js              # aggregate health; alert on nonzero exit
node scripts/releaseMaintenance.js              # dry-run sessions/orphans
node scripts/releaseMaintenance.js --apply      # authorized scheduled cleanup
```

Use a host scheduler with monitored failures; retries pick up PROCESSING/FILES_PENDING jobs, and EXTERNAL_REVIEW stays pending. Never mark COMPLETE for failed provider calls, unknown backup expiry, unresolved shared-record personal references or missing evidence. The existing completion command requires protected evidence references for reviewer, shared records, files/caches, mail/logs and backups/restore ledger. It is an operator attestation, not an automatic check of provider contracts.

## Restore procedure

1. Keep the restored backend closed to traffic and jobs with PAYMI_RESTORE_MODE=1; also prevent socket/background services and any older service deployment from accessing the restored database. The HTTP guard returns503 while the flag is set. The flag alone is not a network firewall or a complete job freeze.
2. Restore the authorized snapshot into an isolated environment, with the matching schema/migrations. Obtain the latest signed deletion ledger from independent protected storage; verify no entries after its export are missing. A ledger older than the snapshot is rejected by the CLI; that freshness check cannot prove the operator selected the latest ledger.
3. Set RESTORE_BACKUP_CREATED_AT to the real snapshot timestamp and provide DELETION_LEDGER_KEY securely. Run `node scripts/deletionLedger.js replay PROTECTED_LEDGER --confirm-offline-restore`. Replay re-erases restored accounts/data, protects shared records and advances account sequences so a new account cannot reuse an erased identity.
4. Check files/caches/mail/replicas and shared-record references again. The replay result explicitly retains provider review; it does not claim immutable backups were selectively deleted. Validate old tokens and delayed writes, record evidence, then separately authorize enabling traffic/jobs.
5. Keep backups inaccessible to normal app operation until actual expiry; record the real expiry and access restrictions in the final policy. Do not publish the30day target until settings/contracts and restore behavior substantiate it.

## Tests actually run

- Synthetic provider failure: job remains PROCESSING, account not yet erased, old tokens/delayed chat writes rejected, retry succeeds to EXTERNAL_REVIEW.
- Strict Redis failure propagates; successful explicit key deletion verified through EXISTS.
- Journal write failure blocks erasure. Signed file excludes email/password and uses0600 permissions; tampering is rejected.
- Synthetic database dump restored all test data into the same isolated schema under maintenance mode; ledger replay removed the restored account, preserved the other owner/workspace and rejected the prior token before traffic reopened.
- Existing personal deletion tests preserve staff/co-owner/tasks/lists, test repeated requests/receipt rotation, file failure retry and role-ID collisions.

Evidence: evidence/deletion-journal-recheck.log, backup-restore-test.log, backend-regression-final-candidate.log. These are local synthetic tests, not a Neon/host production restore or verified provider retention configuration.
