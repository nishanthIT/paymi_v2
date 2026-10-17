# Backend services and chat recovery — 14 October 2026

## Diagnosis and data preservation

The configured PostgreSQL database had not received six release migrations already required by the running backend. `ModerationDeletionJob`, `RevokedSession`, `AccountDeletionJob`, `ChatSuspension`, `ContentReport`, `ChatModerationAction`, `UserBlock`, and `ChatUpload` were absent; Admin/Customer session-version columns were also missing. The moderation worker and session validator query PostgreSQL independently of Redis. Generic catches obscured the missing-schema errors. Missing `UserBlock` also broke chat listing.

Applied the six existing migrations plus `20261014090000_database_cache_fallback` using the installed Prisma `migrate deploy`. The migration test first upgraded a disposable database and checked preserved account IDs, passwords, ownership and shared tasks. No reset, seed, chat repair, replacement conversation, production-data deletion or signing change was performed.

Read-only before/after fingerprints match exactly for **33 Chat rows, 64 Message rows and 77 ChatParticipant rows**. See [live database evidence](evidence/backend-services-live.json). Existing chat history was present; visibility was repaired in queries.

All 15 groups and 15 direct conversations with surviving participants are visible to authorized accounts. Every customer shop has its existing group link. Three direct conversations (four messages) each refer only to a missing account:

- `cmke8jfk2000edg627x9zn5hg`: one message.
- `cmm61a1650000caagk2ubue5d`: two messages.
- `cmm8syujv0002cavsb86v3o6n`: one message.

The owner explicitly chose **“Keep restricted pending verified ownership”** on 14 October. These records remain intact; no account or participant mapping was guessed or recreated.

## Implemented fixes

- Load environment configuration before imported services initialize. Validate session, moderation and cache schemas before listening; diagnostics contain service/error codes without query text, credentials or message content. Health reports dependency failures and worker status.
- Keep the durable moderation worker in PostgreSQL. Redis availability neither creates this queue nor repairs its missing table. Startup now verifies its dependencies.
- Replace the Redis service's memory fallback with `CacheEntry` in the existing database. Write-through persistence covers strings/OTP state, rate limits, hashes, sets, lists and expiry across processes/restarts. Per-key database locks serialize updates. Redis payload revisions are checked against PostgreSQL, so stale Redis entries cannot resurrect consumed codes or deleted cache entries after an outage. No automatic write retries were introduced.
- Common cache writes and increments execute in one database round trip; rate increments and TTL are atomic. SQL uses UTC explicitly, including when the database server timezone differs. Expired entries are inaccessible immediately and are pruned by the running service. Redis mirrors have a maximum five-minute TTL. Backups/provider retention still need separate operational verification; this change does not publish a retention promise.
- Cache-provider erasure remains verified separately during personal account deletion. A Redis outage does not falsely claim provider erasure succeeded.
- Chat listing includes existing participant groups, ALL Chat, authorized shop teams and existing DMs. Listing never creates a team, changes shop links or rewrites participant records. Team rosters derive from verified owners and active employee memberships. Stale participants do not grant private-team access. Names include Admin participants/senders, with batch lookups replacing per-message/per-participant requests.
- Sort conversations by actual visible latest activity rather than stale `Chat.lastMessageAt`. Preserve the existing group/direct sections and styling. Dates use local time today, “Yesterday”, and a date for older activity; late socket events cannot overwrite newer previews.
- The initial live probes returned 200 but took 14–25 seconds for session/chat calls, exceeding the app's configured 10-second timeout. Auth/chat requests now have a bounded 45-second minimum budget; schema checks and independent session reads use fewer round trips. Request failures still surface; writes are not automatically replayed.

## Verification and operation

Builds/uploads/submissions were not requested and were not performed. Validation uses backend APIs, PostgreSQL, an isolated Redis process and mobile source checks; it does not constitute installed-device validation.

Artifacts:

- [Database preservation and coverage](evidence/backend-services-live.json).
- [Final live HTTP readiness/session/chat probes](evidence/backend-services-http-final.json).
- `product-A-backend/tests/backendServices.test.js`: missing-schema diagnostics, durable failover/restart, expiry, concurrent counters, real Redis outage and stale recovery.
- `product-A-backend/tests/chatDirectory.test.js`: existing histories, typed participants, multi-shop rosters, authorization and no writes on GET.
- `product-A-backend/tests/moderationRefinement.test.js`: report submission, moderator investigation/actions, suspensions, durable processing/recovery and preservation of unrelated messages using synthetic local fixtures.
- `paymi_v2/tests/chat-dates.test.mjs`: local dates, year boundary and out-of-order activity.

Executed checks:

| Command / check | Result |
| --- | --- |
| `node node_modules/prisma/build/index.js generate` | PASS; generated client, existing CLI/client version warning retained |
| `node node_modules/prisma/build/index.js migrate deploy` | PASS; seven migrations applied |
| `TEST_DATABASE_URL=<disposable-local-test-db> node --test --test-concurrency=1 tests/*.test.js` | PASS; 120 passed, zero failed, one conditional latency test skipped in this run; [log](evidence/backend-services-regression.log) |
| `TEST_DB_LATENCY_MS=350 ... node --test --test-concurrency=1 tests/latency.test.js` | PASS; the conditional slow-database test passed separately; [log](evidence/backend-services-latency.log) |
| Final focused cache/session/deletion/moderation tests | PASS; 21 passed; [log](evidence/backend-services-focused.log) |
| Final affected chat/history/moderation tests | PASS; 19 passed; [log](evidence/backend-chat-regression.log) |
| Mobile `node --import ./scripts/register-ts-hook.mjs --test --test-isolation=none tests/*.test.mjs` | PASS; 11 passed |
| Mobile `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| Mobile `node node_modules/eslint/bin/eslint.js .` | PASS |
| Backend syntax checks; backend/mobile `git diff --check` | PASS |
| Final live GET `/api/health`, `/api/auth/me`, `/api/chat` | 200 / 200 / 200; 4.5s / 11.2s / 18.1s; session and moderation ready, Redis connected |

The initial complete runs caught an omitted-field/null compatibility mismatch and then a UTC expiry error in an optimization. Both were fixed before the final passing suite and final restart. The final source hashes are recorded in [the source manifest](evidence/backend-services-source-sha256.json). Real-device checks remain NOT TESTED. The development app is configured for LOCAL port 3000; no hosted-backend deployment was performed.

Backend restart command: `node server.js` from `product-A-backend`. The fixed process is started through the development terminal service on port 3000. Stop that process before starting a second copy. Local-only scripts `scripts/verifyChatServices.js` and `scripts/probeLocalChatServices.js` verify data/service state. The HTTP probe uses an in-process 60-second diagnostic token for read-only local requests; it saves no token or private response content. Password login/reporting/moderator writes are exercised only against disposable local fixtures, never customer chats.

A full live visibility audit initially exceeded its read-only transaction timeout; rerunning a coverage-based read audit completed. No records changed in either audit. The detached launch did not remain running; the managed terminal launch did and its startup readiness was observed. Prisma CLI 6.2.1/client 6.4.1 mismatch is a pre-existing warning; generation, migrations and the recorded tests executed successfully with those installed versions.

## Device checks for the owner

1. Reload the app with the updated JavaScript and connect it to this backend. Confirm sign-in/session restoration finishes, with no session-service error.
2. Open Chat: verify ALL Chat, each authorized shop's Team Chat and existing DMs; compare active employee rosters across shops. Other shops' private data must remain inaccessible.
3. Open older history, send a new synthetic message, and check delivery/relaunch, latest-activity order and today/Yesterday/older dates. Use test conversations for moderation actions.
4. From another test account, report that message with a reason/explanation. In the admin Reported Chats page, inspect the report/context, change its status and exercise suspension/removal on synthetic accounts only. Confirm normal messaging resumes after lifting the restriction.
5. Exercise offline/reconnect and logout/account switching. Existing conversations must return without duplicates or another account's cached private history.

Native UI/device checks and staffed moderation operations remain unverified. The three orphaned DMs remain restricted by the owner's decision; restoring their access requires a verified historical mapping/backup.
