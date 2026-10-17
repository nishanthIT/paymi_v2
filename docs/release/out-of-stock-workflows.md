# Out of Stock normal-list repair — 17 October 2026

The missing-column error was a code/database mismatch: Prisma expected `ListProduct.outOfStockSourceListId`, but its additive migration had not been applied. The migration is now applied to the configured database and registered in Prisma. All 3,903 existing list-item rows and their previous fields were unchanged. No existing lists, items, accounts, chats or messages were reset, recreated or consolidated.

## Implemented behavior

- Out of Stock opens the **same list editor and Collect Mode** as ordinary lists. Old `/out-of-stock` links redirect there. Search, scan/add, quantity, urgent flags, supplier/category/aisle filters, export, price correction and collect/undo reuse existing components and APIs.
- The single overview is a view over already-owned/tracked sources. Every item retains its real row and supplier IDs. Virtual `out-of-stock` writes resolve an authorized actual item; direct additions use the user's canonical list for the selected workspace. No write treats the virtual ID as a database primary key or updates every duplicate product in legacy lists.
- New moves remember their original list. **Return to [original list]** uses the normal move operation and current access checks. Historical origins were never recorded, so those items retain the normal destination picker; no original destination is guessed. A deleted/inaccessible original also uses that picker.
- The overview trash action is restored. A single real source uses ordinary delete/untrack confirmation. Multiple existing sources present a chooser, then the same confirmation. Owned deletion removes the selected list and its items; shared removal only stops tracking it. No blanket virtual-list deletion is offered. No real user list was deleted to test this.
- Collected items remain visible after completion, so users can undo collection or return them. Moves/supplier merges are transactional, preserve origins and quantities, reject overflow without partial changes, and serialize concurrent merges/additions.
- Startup/health schema checks now cover list and price-report columns, so an unapplied migration cannot leave a falsely healthy backend serving broken list routes.
- The existing Collect Mode price-correction flow had an employee/customer numeric-ID collision. Reports now use typed owner/reviewer references. Own-report reads cannot expose another account's reports or earnings; review responses select safe identity fields; concurrent approval awards customer points once. Existing customer reports and earnings remain unchanged. Admin reward wording reflects the actual result.

## Database evidence

Only these reviewed migrations were applied; no generic reset, `db push`, seed or data rewrite ran against the configured database:

| Migration | Verification |
| --- | --- |
| `20261016160000_out_of_stock_origin` | Nullable text column. All existing fields across 3,903 items have identical before/after fingerprints; recheck still matches. [Initial repair](evidence/out-of-stock-schema-repair-2026-10-17.json), [recheck](evidence/out-of-stock-schema-recheck-2026-10-17.json). |
| `20261017160000_typed_price_reporters` | New typed references/default CUSTOMER, nullable legacy Customer FK, constraints/indexes. All 4 existing reports' previous fields and all 21 customer earnings remain identical. [Repair](evidence/out-of-stock-price-schema-2026-10-17.json), [ledger registration](evidence/out-of-stock-price-migration-resolve.json). |

Historical reports with ambiguous numeric identities were preserved, not reassigned. Repair scripts roll back on a preservation mismatch or partial schema. Migration rollback by dropping provenance columns is not a safe production rollback once new records use them.

## Actual automated validation

| Executed command | Result / evidence |
| --- | --- |
| Backend: `TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_oos_test node --test --test-concurrency=1 tests/*.test.js` | **163 passed, 0 failed, 1 conditional latency skip**. [Full log](evidence/out-of-stock-normal-list-backend-tests.log). Disposable local PostgreSQL 18 only. |
| Earlier focused `tests/priceReportIdentity.test.js tests/backendServices.test.js` | 13 passed. [Log](evidence/out-of-stock-price-and-readiness-tests.log). |
| Mobile: `node --import ./scripts/register-ts-hook.mjs --test --test-isolation=none tests/*.test.mjs` | **38 passed**. [Log](evidence/out-of-stock-normal-list-mobile-tests.log). |
| Mobile: `node node_modules/typescript/bin/tsc --noEmit` | Passed. [Log](evidence/out-of-stock-normal-list-typescript.log). |
| Mobile: `node node_modules/eslint/bin/eslint.js .` | Passed. [Log](evidence/out-of-stock-normal-list-eslint.log). |
| Prisma generate/validate, changed JS syntax and whitespace checks | Passed. Installed CLI 6.2.1/client 6.4.1 warning remains; no dependency upgrade. |
| Admin price-correction UI | Targeted TypeScript passed, lint 0 errors/one existing hook warning. Full admin TypeScript still has pre-existing errors in AddProduct, Chat and Shops; not claimed passed. |

New HTTP/database regressions exercise ordinary/virtual add, exact-row edit/removal, collected/undo state, supplier groups/changes, original/manual returns, duplicate origins, alternative real-ID routes, concurrency, overflow rollback, tracked untrack, owned delete/recreate, employee permissions, wrong-workspace access, schema readiness and additive migration preservation. Price-report tests cover colliding/noncolliding IDs, typed reads, both review aliases, authorization, safe responses, reward concurrency and typed deletion cascades.

## Runtime and remaining validation

[Local API verification](evidence/out-of-stock-http-2026-10-17.json) passed after starting the updated backend on port 3000. Health, list overview, aggregate Out of Stock, both existing source lists and one ordinary list all returned HTTP 200. The aggregate's 5 rows exactly match the accessible stored rows. Before/after fingerprints of List, ListProduct, Chat, Message, ChatParticipant, PriceReport and Customer are identical. Both migrations are recorded as applied. No test data was added to the main database.

Sessions, moderation and list schema report ready. Redis is not running in this restarted local environment; the established PostgreSQL cache fallback is ready and serves requests successfully. This is separate from the repaired column failure. Main-database reads still take approximately 12–15 seconds over this connection; responsiveness on device remains to be checked. The backend was started with `node server.js` (runtime log `/tmp/paymi-oos-backend.log`); no hosted service was deployed. Do not equate local API tests with an installed phone test.

No app/browser surface is connected (`apps: []`, `browsers: []`). Android/iOS touch interactions, alerts, layout, offline relaunch and the actual installed build remain **NOT TESTED**. Follow the focused checklist at the top of [device-tests.md](device-tests.md). Reload the updated app source; an older installed binary does not contain these UI changes. Owner handles builds, hosted deployment, uploads and store submission. Existing release/provider/moderation-operation blockers are unchanged.

Missing product-image warnings are a separate catalogue/file issue, not the cause of the Prisma failure. They were not resolved by this repair. Existing image placeholders remain.

## Resume safely

Backend scripts: `scripts/repairOutOfStockSchema.js`, `scripts/repairPriceReportSchema.js`, `scripts/probeOutOfStockWorkflows.js`. Repair scripts default to inspection; `--apply` applies only the named reviewed migration with fingerprints. Both migrations have already been applied here; do not blindly rerun migration resolution. Preserve all unrelated dirty work and the supplier-import files. Never point the destructive test harness at the main `DATABASE_URL`.
