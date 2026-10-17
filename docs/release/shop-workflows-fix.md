# Shop workflow repair — 15 October 2026

The user reports the loading screens are now working. The complete backend regression suite, automated mobile checks, separate slow-database check and final read-only API probes pass. The backend was restarted with the fixes and verified locally. This is not a signed-build or store-readiness decision.

## Confirmed causes and repairs

- **Timeouts hid working APIs.** The app allowed 10 seconds for shop selection, lists, employees and products even though their database-backed session checks and queries take longer over the current connection. Initial successful responses took 16.48s (shop directory), 13.00s (lists) and 12.39s (employees). All API requests now have the same bounded minimum 45-second budget; writes are not automatically retried.
- **Failed shop loading hid employee tools.** A signed-in employee could lose the selected shop and projected permissions when the directory timed out. Refresh did not select the recovered default/sole shop. Refresh now restores a verified selection and permissions. A revoked active shop is cleared without silently redirecting queued writes to another shop.
- **Errors looked like empty data.** Employee and product-search screens now distinguish failed requests from genuinely empty results and provide retry controls. Home exposes missing shop context and recovery.
- **Adding several units could partially succeed.** The old mobile flow added one item and then made a separate quantity-edit request. An employee with Add permission but without Edit permission received a failure after one item was already saved. Mobile now sends quantity in one add request. The backend validates positive whole quantities and serializes additions to the same logical list/product, keeping supplier selection and preventing lost concurrent increments.
- **List summaries overfetched data.** The active list endpoint loaded two full relation trees, including every item, product and supplier, to compute summary counts. A scoped parameterized summary query now returns the existing response contract without that hydration.
- **Offline edits lost their target on restart.** Persisted mutation payloads did not match their restoration handlers. Restored list edits now retain the list identity and complete quantity/urgency/stock/move/shared-list payloads. Old paused edits without a provable list identity fail without writing to another list.
- **Other list API defects.** Lowest-price lookup now reads its route parameter. Fractional/overflow quantity edits return a useful 400 response. Admin-owned legacy lists remain visible despite their old shop association. Removed obsolete list-cache invalidations from active routes, whose reads already use the database, so a completed list write cannot report failure merely because an unused cache operation failed.
- **Inventory cache correctness.** Persistent hits no longer rewrite entries and extend their expiry. Process-local product values no longer hide invalidations made by another process. In-flight loaders and publication/invalidation are coordinated within the process so an older query cannot refill a cache after an update. Cache failures remain visible. Redis/PostgreSQL services retain their durable fallback behavior.
- **Session-check latency.** Account and independent suspension/deletion checks now run concurrently. All still must pass before access is granted; no accepted sessions or memberships are cached to bypass revocation.

The supported local runtime exercised here is one backend process. A simultaneous cache-miss loader and mutation in **different backend processes** still require distributed coordination for a strict no-stale-publication guarantee. Do not treat the single-process concurrency tests as a multi-worker deployment test.

## Evidence available

- [Mobile checks](evidence/shop-workflows-mobile-validation.json): 15 tests passed; TypeScript, ESLint and diff checks passed. Includes actual React Query dehydrate/hydrate/resume regression coverage.
- [Complete backend suite](evidence/shop-workflows-backend-tests.log): 136 cases, 135 passed, 0 failed, 1 conditional latency case skipped in the normal run. This includes 6 new real HTTP/database shop-workflow tests and 9 cache regression tests. Existing authentication, authorization, deletion, moderation, chat, migration and shop-tool suites also passed.
- [Conditional latency test](evidence/shop-workflows-latency.log): the skipped case passed separately with 350ms injected per-packet database delay (138.79s total). Employee creation, directory loading, activation/deactivation and login were exercised. Across the two runs, all 136 backend cases passed.
- [Focused shop workflow tests](evidence/shop-workflows-focused.log): 6 passed. Covers login, employee read/add/edit rights, quantity 3 in one POST, concurrent additions preserving the sum, sharing/renaming, search/barcode/details/prices, membership lifecycle, isolation and legacy admin lists. Mutations ran only on the disposable database.
- [Local API checks and aggregate fingerprints](evidence/shop-workflows-http.json): health, shop directory, lists, employees and product search all returned HTTP 200 against the configured database. Sampled workspace returned 9 lists and 2 employees; search returned 20 products. These counts are scoped to the selected account/shop, not a claim that every user sees every record.
- On that run, list loading took 6.65s, employees 9.22s, shop directory 14.62s and product search 15.05s. This is a real slow-link limitation; increasing a timeout does not make the network fast. These are individual observations, not a controlled performance benchmark.
- PostgreSQL fallback initialized and served these API reads while local Redis was unavailable after the environment restart. Session validation and the PostgreSQL moderation queue initialized successfully.
- [Final restart checks](evidence/shop-workflows-http-final.json): all five HTTP checks passed again with Redis connected and the durable PostgreSQL fallback ready. Session validation and moderation reported ready. Lists took 6.69s, employees 11.42s, shop directory 15.15s and product search 14.96s. All eight recorded table fingerprints matched the immediately preceding read-only diagnostic, including chats/messages and memberships.

No existing application records were reset, seeded, recreated or deleted for this repair. Main-database diagnostics are read-only; mutating workflow tests use a disposable local test database. The read-only inventory contains 96 lists, 3,997 list items, 66,545 products and 13,310 supplier-product rows. Their fingerprints match the earlier 14 October diagnostic. Chat has 65 messages now versus 64 in the earlier run, and membership fingerprints changed between sessions; do not claim the entire active database stayed byte-identical while users used it. Three orphaned direct conversations remain restricted as instructed.

## Reproduction commands

Run backend commands from `product-A-backend`, with a disposable local database only:

```sh
TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_moderation_test node --test --test-concurrency=1 tests/*.test.js
TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_moderation_test TEST_DB_LATENCY_MS=350 node --test --test-concurrency=1 tests/latency.test.js
node scripts/probeShopWorkflows.js
```

The first two commands reset only the explicitly named disposable test database; the test harness rejects remote/non-test URLs. Never replace `TEST_DATABASE_URL` with the main database. The last command makes read-only local HTTP requests and database fingerprints, with a short-lived diagnostic token kept only in memory. It prints no credentials, IDs or private row contents. Final startup command: `node server.js`; source hashes are recorded in [source evidence](evidence/shop-workflows-source-sha256.json).

Run mobile commands from `paymi_v2`:

```sh
node --import ./scripts/register-ts-hook.mjs --test --test-isolation=none tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
```

## Remaining verification

- Perform the focused owner/employee device checks in [device-tests.md](device-tests.md), including actual offline app restart, permission changes, quantity addition and shop switching. The user's successful screen check is useful feedback, not a substitute for all scenarios on Android and iOS.
- Existing release, provider-retention and moderation-operation blockers remain in the release documents. This repair does not resolve those by implication. The owner continues to handle native builds, uploads, submissions and publication.
- Before deploying multiple backend workers/replicas, complete distributed inventory invalidation coordination and concurrent-worker testing. No multi-worker deployment was performed here.

The disposable test cluster is `/tmp/paymi-workflows-pg`, port 55441, database `paymi_moderation_test`, role `paymi_release`. It was stopped after verification. Local backend and Redis remain running on ports 3000 and 6379; no hosted deployment or native build was performed.
