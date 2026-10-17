# Resume state — 17 October 2026 (Out of Stock normal workflows)

Latest handoff: [out-of-stock-workflows.md](out-of-stock-workflows.md). Shared normal editor/Collect Mode now replaces the bespoke OOS screen. Exact-item API resolution, canonical direct adds, provenance-preserving returns, supplier merges, collection undo and ordinary confirmed delete/untrack are implemented. Existing access scope remains owned/tracked sources. No legacy consolidation or historical-origin guessing.

The reported missing `ListProduct.outOfStockSourceListId` column was repaired in the configured database with migration `20261016160000_out_of_stock_origin`; all 3,903 items' existing fields remained identical. Separate typed price-reporter migration `20261017160000_typed_price_reporters` fixes employee/customer identity collisions; all 4 prior reports and all 21 customer earnings remained identical. Both are registered in Prisma. Earlier no-migration statements below describe prior batches.

Validation: full backend 163 passed/0 failed/1 optional latency skip; mobile 38 passed; full mobile TypeScript/ESLint passed. New tests cover actual HTTP/database workflows and migration preservation. Logs use `evidence/out-of-stock-*`. Local read-only API probe passed all six routes (HTTP 200), matched all five accessible Out of Stock rows, and preserved seven table fingerprints. Backend is running on port3000 with sessions/moderation/lists ready, PostgreSQL cache fallback (Redis unavailable in restarted environment). Device checks remain open. No native build, hosted application deployment or store action; owner retains those tasks. Admin unrelated full-TypeScript errors remain; targeted price-correction checks passed.

User data is never used for destructive tests. Disposable PostgreSQL18 `/tmp/paymi-oos-pg`, port55441, `paymi_release`/`paymi_oos_test` is separate from main DATABASE_URL and was stopped after tests. Never reset main data. Follow this latest handoff rather than repeating the earlier audit. Preserve unrelated files, including supplier data/import work. Device gestures/layout/offline relaunch are NOT TESTED; no connected UI surfaces.

## Historical resume state — 16 October 2026 (five feature refinements)

Latest handoff: [feature-refinements.md](feature-refinements.md), with machine-readable results in [evidence/feature-validation.json](evidence/feature-validation.json). Completed temperature sign controls/default freezer negatives, searchable age categories/optional catalogue product, compact VAT/margin/markup calculator, one Out of Stock view grouped by supplier ID, and historical/floating chat date headers. Related fixes add temperature retry states and appropriate staff action controls.

Owner confirmed Out of Stock combines supplier shops within existing owned/tracked list access; it does not grant all staff access. Backend GET `/lists/out-of-stock` aggregates existing canonical/legacy lists read-only. New marks use one canonical destination per typed account/workspace and preserve row IDs/quantities/suppliers/flags. Original lists remain reachable through Manage original lists, including empty/shared sources. No data migration, repair write or deletion in the main database. Three orphaned DMs remain restricted as instructed.

Final review fixed disappearing move-result callbacks during optimistic removal, retained original list-management actions, and corrected supplier-row item counts. Tests include a real TanStack MutationObserver failed-move regression and HTTP/database verification of counts and original IDs. Main data and existing chat histories are not seeded, reset, recreated or consolidated.

Final checks: full backend **143 passed, 0 failed, 1 conditional latency skip**; focused backend21 and final list regression10 passed. Full mobile **36 passed**, TypeScript/ESLint/diff checks passed. Evidence uses the uncommitted working tree; hashes are in `evidence/feature-source-sha256.json`. The conditional latency case was not rerun in this feature batch. Automated checks do not prove native layout/scrolling.

Remaining for this batch: run the updated backend and reload/build updated mobile source, then complete the five focused device scenarios at the top of [device-tests.md](device-tests.md). UI inventory returned no enabled app/browser surfaces, so Android/iOS keyboard, category picker and chat scrolling are NOT TESTED. No hosted deployment, native build or store action performed; owner still handles builds/uploads/submission/publication. Both store release verdicts remain BLOCKED by the existing release/provider/device requirements. No new schema migration is needed for these refinements.

Disposable PostgreSQL18 cluster `/tmp/paymi-features-pg`, port55441, rolepaymi_release/dbpaymi_moderation_test was stopped after final tests. Never point the destructive test harness at the main DATABASE_URL. Main backend/Redis startup state was not revalidated in this batch. Preserve all unrelated dirty work. Do not repeat the earlier audit; continue from the current handoff.

## Historical resume state — 13 October 2026 (moderation refinement)

Latest authoritative implementation/handoff: [moderation-refinement.md](moderation-refinement.md). Owner explicitly handles **builds as well as submissions/publication**; do not start new native builds or seek publishing credentials. No build, production deployment or production migration was performed in this refinement batch. Previous EAS jobs/binaries predate the refinement; do not label them current candidates.

User-authorized changes: no mandatory chat rules acceptance or replacement screen; real long-press reporting; full Admin Reported Chats review; distinct chat/account restrictions and individual/bulk message removal; My Supermarket section and exact account-menu ordering. Implemented across existing projects with additive migration `20261013100000_moderation_refinement` (production unapplied). Rules remain non-blocking. Report evidence is private; Admin may view reporter, subject and bounded context. Personal deletion preserves shared workspaces. No indefinite suspensions; custom durations up to 30 days are supported. Durable bulk jobs resume through the server worker.

See evidence/moderation-validation.json and moderation-prefixed logs. Tests use a new disposable local cluster /tmp/paymi-moderation-pg, database paymi_moderation_test, port55441; never use the shared Neon URL. All user edits, including mobile .env and unrelated supermarket work, were preserved. No agents were used.

Outstanding: real-device/browser interactions; existing admin TypeScript/runtime defects in Chat/AddProduct/Shops; live deployment/resources; provider retention/deletion verification; staffing/escalation/filtering and privacy facts. Google Play terms-before-UGC requirement remains FAIL after removing the requested gate; no verified alternative account-level acceptance exists. Do not reintroduce a mandatory chat screen without a new owner decision. Both stores remain BLOCKED.

Confirmed contact: Kaliam, support@paymi.co.uk, owner-supplied 07534 333494 (+447534333494), delivery/call not tested. UK public, India testing, intended13+, free/no billing. Public promotions were expressly approved and implemented in the previous continuation. Owner retention targets remain implementation-only until verified. Exact rejection/listing status still unknown. Do not re-ask settled decisions.

## Historical 12 October record (superseded where above differs)

# Resume state — 12 October 2026

**App Store BLOCKED. Google Play BLOCKED.** See README.md for the complete register and deliverables. No production writes/deletion, new keys, paid cloud build, upload, submission or deployment performed. EAS and configured database inspections were read-only. Preserve both repositories' unrelated multi-shop work; initial Git states are in evidence/.

## Confirmed owner decisions

Kaliam; support@paymi.co.uk. Free release, no subscriptions/billing. UK public launch, India test access. Intended 13+ owners/employees (not 18+). Keep private-workspace auth; no guest redesign without an explained decision. Personal deletion preserves shared shops/staff, retains existing authorized co-owners, never auto-promotes staff; workspace deletion is separate. Retention targets approved for implementation only: personal7days, backups/security/mail30days, orphan uploads24h, minimal evidence90days. Verify before publishing.

Pending owner facts: existing store-listing status/rejection, console/signing/Mac/build access, actual provider retention/shared-record basis, operator legal/rights facts and real moderator operation/global chat decision. An asynchronous moderation question was sent; no reply recorded as of this update. Do not ask again for already confirmed facts.

## Completed audit / changes

Read AGENTS.md and exact Expo57 docs, manifests/lockfiles/auth/navigation/permission and backend schema/migration/access code, existing work docs, official store starting requirements. Added policy/access/data inventories and store-specific drafts.

Source fixes: release URLs/profiles/TLS, unused permissions/backup, manual scanning, durable session revocation/password reset versions/rate limits, free access, authenticated chat media and anti-spoof sockets, personal deletion request/worker/status/public resource/operator review, community agreement/report/block/admin removal, public support info, compiler/lint form/search fixes. Four new release migrations are local only; running new backend code against old shared DB without them is unsafe/unavailable. Local Prisma client has been regenerated.

## Validation / live task state

- Backend: 95 pass, 0 fail, 1 conditional latency skip; that skipped case then passed separately with 100ms injected database latency, in disposable local PostgreSQL on127.0.0.1:55441/paymi_release_test. Never replace TEST_DATABASE_URL with the shared Neon URL.
- Mobile:6 pass; TypeScript and ESLint exit0 with explicit results in evidence/validation-results.json. Final production exports succeeded under/tmp/paymi-release-export.
- Native temporary CNG copy:/tmp/paymi-release-native; localSDK:/tmp/paymi-release-sdk; Gradle cache:/tmp/paymi-release-gradle. Android36/build tools and NDK downloaded; existing SDK untouched. Final processReleaseMainManifest succeeded; summary in android-merged-manifest-final.json.
- All bundleRelease attempts were interrupted before an AAB appeared. No build success is claimed. Resume from cached native tasks only after confirming the new source/config and intended signing. Temporary native project uses test/debug signing and local versionCode 2. Earlier bundle source predates new screens; current temporary source was synchronized, but inspect source map/artifact before claiming final-source coverage.
- No iOS archive, signed store candidate, real release-device tests or actual store screenshots. No successful live policy/deletion URL or reviewer login claimed.

## Remaining work

Reconcile final Android attempt; save hashes/actual native inspection if it succeeds, with signing limitation. Finish version/SDK manifests/device evidence after environment access. Deletion external/shared/backups/restore/write-drain and scheduling still blocked;90-day evidence expiry not implemented. UGC filtering and staffed operation absent. Legacy label role-key migration, offline revocation/cache restoration, distributed throttling/log redaction and dependency reproducibility need work. Final public policies/forms require verified inputs. Owner-actions.md separates these engineering tasks from owner input.

No scope/product decision was silently changed to guest access or18+. No review approval is implied by local test passes. Continue from these files instead of repeating the audit.

Final source follow-up: message cleanup now accepts only normalized tracked uploader-owned chat files, checks remaining references under the send/maintenance upload lock, and preserves untracked legacy files for review. Final affected deletion/chat tests are in evidence/deletion-chat-final.log. Public HEAD probes returned403; actual global URL reachability remains blocked. Docs now live in paymi_v2/docs/release with a root compatibility symlink.

Final handoff: all13 affected deletion/chat checks passed after the last cleanup changes. The local test PostgreSQL instance is stopped; restart only/tmp/paymi-release-pg on port55441 for future tests. Browser/app inventory returned no enabled sessions; console-access.json records this access limitation. No AAB/IPA exists from this batch. Latest mobile export/compiler/lint outcomes are in validation-results.json.

## 14 October 2026 — backend service root cause and chat visibility

Continue from `backend-services-fix.md` and its evidence links. The six previously pending release migrations and the new durable PostgreSQL cache migration are now applied to the configured database. Session/moderation dependency tables existed only in code before this fix; Redis was not their cause. Chat/Message/ChatParticipant fingerprints remain identical (33/64/77). Query fixes expose 30 authorized conversations; the owner explicitly chose to keep three orphaned DMs restricted pending verified ownership. The backend has been started locally on port 3000. Device tests are still required. The earlier “production migrations not applied” notes describe previous batches and are superseded for these seven migrations. No native build or store action was performed.

Final verification for this batch: 120 backend tests passed in the complete run; its one conditional test passed separately with 350ms injected database delay. Mobile 11 tests, TypeScript and lint passed. Final HTTP probes returned 200 for health, session and chats; readiness is recorded in evidence/backend-services-http-final.json. The backend remains running locally on port 3000. Detailed commands/results and owner device checks are in backend-services-fix.md.

## 15 October 2026 — lists, employees, products and cache recovery

Latest handoff: [shop-workflows-fix.md](shop-workflows-fix.md). User confirms screens now work. Root causes: 10-second API budget below observed 12–16-second successful responses; failed shop-directory recovery hid employee permissions; errors looked like empty results; quantity-add needed an inappropriate second Edit request; persisted list mutations lost IDs/payloads; summary queries overfetched; obsolete cache invalidation could fail after committed writes; inventory cache hits rewrote TTLs and pending loads could restore stale values. Fixes preserve real memberships, existing records and UI design. No dummy records or main database repair writes.

Final validation: complete backend 135 passed/0 failed/1 conditional skip; conditional latency case passed separately at350ms (136 backend cases passed across runs). Mobile15 passed; TypeScript/ESLint/diff checks passed. New HTTP/database tests cover employee write-only quantity3, concurrent increments, products, summaries, sharing, permissions, activation and cross-shop isolation. Final local five-route HTTP probe passed after restart with Redis/session/moderation ready. Eight main-database table fingerprints remained identical during final verification. Evidence files are `evidence/shop-workflows-*`.

Runtime: local backend3000 + Redis6379 running. Fresh disposable PG18 cluster `/tmp/paymi-workflows-pg`, port55441, rolepaymi_release/dbpaymi_moderation_test stopped after tests; the previous `/tmp/paymi-moderation-pg` disappeared with the environment restart. Never run reset tests against main DATABASE_URL. Owner still handles builds/uploads/submission/publication.

Remaining: focused real Android/iOS checks in device-tests.md; slow remote-database link still measurable; legacy offline mutations without a verifiable list ID require manual re-entry; strict simultaneous multi-worker inventory miss/mutation coordination is not implemented (single-process race and cross-process invalidation of completed entries are tested). Other existing release/provider/moderation-operation blockers remain. Do not claim every device workflow or production deployment verified.
