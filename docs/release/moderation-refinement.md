# Chat moderation and account menu — 13 October 2026

Implemented in the existing mobile, Express/Prisma and admin projects. No production database changes, deployment, new build, store upload or submission in this refinement batch. The owner now handles builds and publication. Older binaries/build jobs predate these changes and are not candidates for this source.

## Implemented behavior

- Removed acceptance validation from message and upload APIs and removed the mobile Accept button. New and existing accounts can post immediately. Rules remain a non-blocking link. Historical CommunityAcceptance rows are preserved but no longer grant or deny access; the compatibility `/accept` endpoint is a no-op.
- Long-press offers **Report Message** for another user's message alongside existing Copy controls. Own messages retain their actions and cannot be reported on the server. Normal bubble taps do not report. The reporting form requires a reason, allows up to 1,000 characters of explanation and shows success/error feedback; repeat submissions retain one report per reporter/message under a message lock. Blocking stays available.
- **Reported Chats**, `/moderation`, extends the existing admin screen. The queue separates reporter and reported account, exact message/time, conversation, category, explanation, creation date and status. Search by account name/email, report ID or reason; filter by typed account ID/status/date; sort by date/status/reporter ID/reported-user ID, with pages of 50.
- Investigation shows the preserved original evidence, account names/emails, up to 11 nearby available messages, latest 20 related reports and latest 100 audit actions. Only company Admin accounts can use these APIs; company staff with `content.manage` alone cannot. Context and attachment access are audited. Reporter details and internal notes are never returned to the subject through user safety endpoints.
- Pending, Under Review, Resolved and Dismissed status transitions are separate from account actions. Internal notes are audited. Status changes never impose a restriction or delete messages.
- Chat-only and account-wide temporary restrictions reuse ChatSuspension with separate scopes. Durations: 1 hour, 24 hours, 7 days, 30 days or custom 1–43,200 minutes. No indefinite restriction. Required reason, start/expiry and actor are recorded. Early lift and extension are confirmed and audited. Account suspension rejects login, existing authenticated REST requests and socket access; chat restriction only denies posting/uploads/typing. Database expiry works after restart. Platform Admin peers cannot be restricted through this interface.
- Single-message removal requires confirmation and does not change report status, account state or other authors. Bulk removal requires two UI confirmations including typing the selected typed identity, and both confirmations are validated server-side. It queues only that author's messages up to a fixed cutoff. Newer messages, other authors and the account remain. Transactions process 100 messages at a time with job/message locks, retry-safe progress and error feedback. Original report evidence is retained separately. Removal events update connected clients; thread reconnect refetches missed changes, including direct deep-link entry without the tabs listener.
- My Supermarket is the first separate section, containing selection/management and existing workspace tools. The account menu follows: Shop Employees (when permitted), Report a Wrong Price, Log Out, Delete Personal Account, About PayMi, Privacy Policy. Existing private-tool permissions and personal deletion are preserved. Privacy Policy opens the existing in-app privacy information; the complete public policy remains blocked by unverified release facts.

## Files and migration

Backend: `prisma/schema.prisma`; new `prisma/migrations/20261013100000_moderation_refinement/migration.sql`; `src/routes/chatSafetyRoutes.js`, `src/routes/moderationRoutes.js`, `src/routes/chat.js`; `src/services/moderation.js`, `chatSafety.js`, `moderationEvidence.js`, `accessControl.js`, `accountWriteBarrier.js`, `accountDeletion.js`; `src/controller/chat.js`, `auth.js`; `scripts/releaseQueueHealth.js`; `server.js`.

Mobile: `src/app/(app)/chat/[id].tsx`, `src/app/chat-safety.tsx`, `src/features/chat/components/message-bubble.tsx`, chat hooks/socket, `src/services/api.ts`, `src/app/(app)/(tabs)/profile.tsx`, `src/app/about.tsx`.

Admin: `src/pages/Moderation.tsx`, `src/components/Navbar.tsx`. Tests: backend `moderationRefinement.test.js` plus updated chatSafety/moderationWorkflow/releaseMigrations; mobile `chat-moderation-cache.test.mjs`; admin `tests/moderation-render.test.mjs`.

The migration follows all existing migrations through `20261012124000_moderation_evidence_suspension`. It adds report explanation/typed subject/chat relation, maps legacy statuses, extends restriction scope and adds report-linked audit entries and durable removal jobs. It preserves users, passwords, shop ownership and prior evidence. Account identities are typed references because the existing architecture has separate Admin/Customer/Empolyee tables; Message, Chat and report-action links use foreign keys. Do not combine same numeric IDs across those types. This migration has been tested locally, **not applied to production**.

## APIs (all under `/api/chat-safety`)

| Method/path | Access and behavior |
| --- | --- |
| GET `/` | Signed-in user: own blocks and active chat restriction; no acceptance gate |
| POST `/accept` | Legacy compatibility only, no-op |
| POST `/report` | Signed-in reporter; messageId, reason, optional explanation; accessible non-own messages only |
| POST `/block`, DELETE `/block/:id` | Existing personal blocking |
| GET `/reports` | Admin queue; status, q, reporter, reportedUser, from, to, sort, direction, page |
| GET `/reports/:id` | Admin details/context/history/restrictions |
| GET `/reports/:id/attachment` | Admin protected evidence download |
| POST `/reports/:id/status` | Admin status + internal note, no account effects |
| POST `/reports/:id/notes` | Admin internal note |
| POST `/reports/:id/suspension` | Admin scope CHAT/ACCOUNT, minutes, reason; target derived from report |
| GET `/suspensions` | Admin active restrictions |
| POST `/suspensions/:id/extend`, `/lift` | Admin reason; duration for extend |
| POST `/messages/:id/remove` | Admin reason and exact message confirmation |
| POST `/reports/:id/delete-user-messages` | Admin reason, typed target confirmation and confirmAll=true; returns durable job, HTTP 202 |
| GET `/deletion-jobs` | Admin progress and retry failures |
| POST `/reports/:id/resolve` | Older admin-client compatibility operation; current UI separates removal/status |

`server.js` starts the removal worker, polling every two seconds while the backend runs. It resumes persisted jobs after restart, skips restore mode and serializes multiple workers with database locks. Keep the backend process supervised. Monitor failures and stale jobs; do not assume a job is complete from HTTP 202. Private attachment/evidence storage must be durable and shared appropriately if running multiple hosts; Socket.IO routing across hosts requires the corresponding adapter/operating configuration. Distributed hosting was not validated here.

## Validation and limitations

Results: backend113 passed/0 failed/1 conditional skip; the skipped latency case passed separately at100ms. Mobile9 passed; mobile TypeScript and changed-file lint exit0. Admin rendering2 passed; full admin TypeScript exit2 due to the existing errors below. Evidence files use the `moderation-` prefix under `evidence/`. See `moderation-validation.json` for actual final results. The integration tests use only `127.0.0.1:55441/paymi_moderation_test`, seeded with synthetic accounts. Never run them against Neon/production.

The new admin page passes rendering checks, including reporter/subject mapping, escaped message HTML and empty state. The full admin TypeScript check still fails in pre-existing `Chat.tsx`, `AddProduct.tsx` and `Shops.tsx`; no final errors are reported for Moderation.tsx. The older admin Chat page also has stale API/response assumptions and a missing formatter. Those existing issues remain unresolved; the new Reported Chats workflow uses its own current moderation endpoints.

No enabled browser, Android device or iPhone was available. Real long-press/tap behavior, focus/accessibility, responsive layout, dialog operation and installed-client live updates are **NOT TESTED**, despite backend/socket and cache checks passing. No signed native candidate was built in this batch.

### Release policy gap — not an acceptance screen replacement

Google Play's [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), rechecked 13 October 2026, requires acceptance of terms/user policy before contributing UGC. No verified account-level acceptance exists in the inspected registration flow. Removing the chat acceptance gate fulfills the requested UX change but leaves this Play requirement **FAIL**. No new mandatory screen/gate was added. Before store release, agree and verify an appropriate account-level terms process without the broken chat interstitial. Do not claim current posting access is Play-compliant.

Apple [guideline 1.2](https://developer.apple.com/app-store/review/guidelines/), rechecked 13 October 2026: reporting/blocking and technical admin actions are implemented; actual staffed response, filtering and operational escalation remain unverified. Neither store is marked ready. Retention periods remain approved implementation targets, not published promises. Full live privacy/support/deletion resources and provider deletion/retention verification are still outstanding in the release register.

## Owner/device acceptance checklist

1. Deploy the reviewed migrations/backend/admin together in staging first. Confirm ordinary Admin access to Reported Chats and worker progress; no company/shop employee may call admin moderation endpoints. Do not deploy to production without the normal authorization and backup procedure.
2. On Android and iPhone, log in as both a fresh user and an existing user with no acceptance record. Open a direct/team/global chat, send/receive text and an image immediately. Ordinary taps must not open reporting; long-press must show Copy and Report Message for others, never Report for your own messages.
3. Report with each reason and optional explanation. Retry to verify one report. In Admin, verify reporter versus sender, timestamps, evidence, filters, notes/status and action history. Author deletion must not erase report evidence. Check failed request feedback.
4. Restrict chat: try a second session, uploads and typing; shop tools must remain usable. Test custom expiry, restart, early lift and extension. Account-suspend separately: deny protected access/login, preserve records and recover after expiry/reactivation. Personal deletion must still be available through password reauthentication, not turn into suspension.
5. Remove one message while two clients are open; reload/reconnect and check previews. Bulk-remove a synthetic user's history via both confirmations. Confirm only pre-cutoff messages from that typed account disappear; other authors and newer messages remain. Stop/restart the backend mid-job and verify resumable completion/error visibility.
6. Check Profile on small/large screens with text scaling: My Supermarket separate at top; the six account entries in the requested order (employee management only for authorized roles); selection, logout, actual deletion and privacy navigation still work. Verify TalkBack/VoiceOver message-actions access and modal focus.

Record device, OS, source commit/hash, steps, actual result and screenshots. Build/upload/submit/publish yourself after the outstanding release requirements and device tests are satisfied; no approval is promised.
