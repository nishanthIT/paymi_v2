# Retention and deletion decision — proposal, not published policy

12 October 2026. Operator: Kaliam. Contact supplied by owner: support@paymi.co.uk. No mailbox delivery has been tested.

## Facts inspected

The read-only production inspection identified Neon PostgreSQL and no deletion-request/deletion-job table. Aggregate/schema evidence: `evidence/retention-readonly.json`. Local uploads contain chat, certificate, incident, product and age-restriction files. Existing private backups include a retained database dump from 12 October; earlier repository evidence reports a successful restore. This session did not repeat that restore or inspect personal rows. Database provider backup windows, SMTP provider message retention, hosting/access logs and Redis persistence are not exposed by the local configuration. They remain unverified.

OTP lifetime is 10 minutes in code; resend delay 60 seconds; persisted mobile query caches expire after 7 days. These are implementation settings, not a complete service retention policy. Shared operational records currently have no scheduled expiry. Legacy migration ledgers contain JSON evidence that needs personal-data review before any automatic erasure claim.

## Owner-approved implementation targets (verification outstanding)

| Data | Proposed schedule/action | Required evidence before publication |
| --- | --- | --- |
| Personal authentication, profile, memberships, personal lists and authored chat content | Remove during an authenticated deletion job; revoke access when processing begins. Target completion within 7 days, including processor checks. | Worker, retries, repeat requests, files and processor completion tested |
| Shared shop lists, tasks and operational records | Preserve the workspace and other people's records. Remove departing user's direct profile/creator linkage where feasible; review free-text/photo references individually. No invented statutory retention. | Approved organization retention basis and tested attribution migration |
| Workspace ownership | Keep any existing authorized co-owner. If none exists, preserve the workspace for operator-assisted verification/transfer; never promote staff automatically. Personal deletion must still proceed. | Verified transfer process; no takeover through an arbitrary email |
| Backups, including retained local recovery dumps | Expire within 30 days after deletion; maintain a deletion ledger so a restore cannot recreate an active account before reapplying erasures. | Neon/hosting retention setting, local backup lifecycle, tested restore-with-erasure procedure |
| Security and service logs | 30 days, with credentials and unnecessary personal content excluded. | Hosting/log processor settings and sampling |
| Unattached uploaded files | Delete after 24 hours. | Safe orphan detection and retryable file cleanup |
| Minimal deletion evidence | 90 days after completion, then remove identity links. No raw password/token or unnecessary personal data in the job ledger. | Access restriction and scheduled cleanup |
| Transactional mail provider copies | Proposed maximum 30 days where controllable; otherwise disclose actual verified provider practice. | Zoho/other configured provider settings/contract |
| OTP secrets | Existing 10-minute TTL; remove on use/deletion. | Verify distributed attempt counting and actual Redis expiry |
| Shared shop workspace deletion | Separate explicit authorization; not part of personal deletion. Schedule remains undecided. | Owner approval for each workspace and retention obligations |

The owner approved these periods as implementation targets only. They are not verified law or current provider behaviour. Do not publish the periods or label deletion complete until every relevant processor/backup mechanism and shared-record review is implemented and tested. The code now provides durable requests, staged processing and status; production execution and all-provider completion remain blocked.
