# Shop tools and chat refinements — 16 October 2026

This batch implements the five requested feature changes in the existing app. Automated verification is recorded below; installed Android/iOS behavior is still **NOT TESTED**. The owner handles native builds and all store actions. No existing application data was reset, migrated, consolidated in place, or used for destructive tests.

## Changes and boundaries

| Area | Observed issue and implementation | Verification |
| --- | --- | --- |
| Temperature logging | The existing server parser accepts signed decimals, including −23; the numeric keypad made negative entry difficult. Explicit negative/positive controls now accompany the decimal keypad. New freezer entries default negative; actual positive freezer alarm readings and positive fridge readings remain valid. Empty/unfinished/invalid values cannot become zero. Loading failures show Retry; logging follows staff write permission. | Real HTTP/database save and reload of −23, +4 freezer alarm, +3.5 fridge, limits editing, duplicate-slot/invalid-input rejection, read-only and cross-shop denial. Sign/decimal helper tests. Native keypad still untested. |
| Age records | Replaced plain category entry with searchable existing suggestions; optional catalogue product search by name/barcode. “Use new category” saves a shop-local category snapshot with the record, reusable by later records. It does not grant staff global taxonomy write access. Product names/categories remain historical snapshots, consistent with the existing schema. Add/edit/delete UI uses existing permissions. | HTTP/database tests cover suggestions, new category save, edit/clear optional product, reload, private-product exclusion, and permission revocation. Picker interaction still requires a device. |
| Profit calculator | Compact Product/Case/Bulk layout; manual-price and target-profit modes; adjustable VAT and profit controls; explicit margin/markup; keyboard avoidance and scrollable fields with results/Done. Fractional unit cost is retained until totals; target selling price rounds up to pennies. | Arithmetic tests cover VAT, margin/markup, case/bulk totals, fractional costs, zero/loss, percentage controls and validation. Native keyboard geometry remains untested. |
| Out of Stock | One display collection groups authorized items by supplier **ID**, retaining distinct suppliers with identical names. New unavailable items use one canonical destination per account/workspace. Existing supplier-specific lists and item IDs remain intact and are included through their current owned/tracked access. Real list/item IDs continue to drive mutations. “Manage original lists” preserves access to rename/export/item management and confirmed delete/untrack actions, including empty originals. | HTTP/database tests cover concurrent moves, one destination, old/new rows, unchanged records on aggregate read, original detail links, quantities/flags, collection, move-back, tracking, read-only permissions and cross-shop denial. Mobile tests exercise grouping, cache updates, rollback and a real TanStack mutation observer during a failed move. |
| Chat dates | Historical message timestamps drive inline date separators and a translucent top visible-date indicator for the inverted list. Labels use Today/Yesterday/full date; midnight and app resume refresh labels. Pagination and existing messages remain intact. | Date and visible-index tests cover historical dates, local-day boundaries and inverted ordering. Actual scrolling, incoming messages while scrolled back and pagination geometry remain untested. |

The approved Out of Stock scope is **combine supplier shops; preserve existing list access**. It does not expose all staff lists or merge workspaces. Old list links remain valid. No chat records or timestamps are rewritten. Ordinary move-back retains its existing merge behavior when that destination already contains the supplier product; aggregate reads and marking Out of Stock do not merge/delete rows.

Final review corrected two aggregate regressions: the selected item's source identity now survives optimistic removal so mutation failure callbacks remain attached; and original list management stays reachable after the cards are combined. Out of Stock summary counts now count supplier rows, matching the detail screen even when different suppliers sell the same logical product. Ordinary list count semantics are unchanged.

## Executed checks

Run backend commands from `product-A-backend`, mobile commands from `paymi_v2`.

| Command | Executed result | Evidence |
| --- | --- | --- |
| `TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_moderation_test node --test --test-concurrency=1 tests/outOfStock.test.js tests/multiSupermarkets.test.js tests/toolEntryRefinements.test.js tests/shopTools.test.js` | PASS: 21 tests | [Focused API/database log](evidence/feature-focused-backend-tests.log) |
| `TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_moderation_test node --test --test-concurrency=1 tests/*.test.js` | PASS: 143 passed, 0 failed; 1 conditional latency case skipped | [Complete backend log](evidence/feature-full-backend-tests.log) |
| `TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_moderation_test node --test --test-concurrency=1 tests/outOfStock.test.js tests/shopWorkflows.test.js` | PASS: 10 tests after final summary-count correction | [Final list API/database log](evidence/feature-out-of-stock-final-backend.log) |
| `node --import ./scripts/register-ts-hook.mjs --test --test-isolation=none tests/*.test.mjs` | PASS: 36 tests, 0 failed | [Complete mobile test log](evidence/feature-mobile-tests.log) |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 | [TypeScript log](evidence/feature-typecheck.log) |
| `node node_modules/eslint/bin/eslint.js .` | PASS, exit 0 | [ESLint log](evidence/feature-lint.log) |
| `git diff --check` in both repositories; `node --check` for changed backend routes/services | PASS, exit 0 | [Machine-readable results](evidence/feature-validation.json) |

The conditional slow-database case was not rerun for this batch; its separate 15 October pass remains historical evidence, not a new test result. Backend suites use an isolated PostgreSQL 18 cluster in `/tmp/paymi-features-pg`; the harness refuses a remote or non-test database. No main database write or hosted deployment was performed in this batch.

The Expo Router route declarations in ignored `.expo/types/router.d.ts` were regenerated using the installed Expo generator after adding the new route; no route type casts or dependency upgrades were used. Source fingerprints are in [feature-source-sha256.json](evidence/feature-source-sha256.json).

UI automation inventory on 16 October returned no enabled apps or browsers. No native build, signed artifact, screenshot or installed-device pass is claimed. Run the updated backend and reload/build the updated app before using the focused checklist at the start of [device-tests.md](device-tests.md). No new schema migration is needed for this feature batch. Existing release and provider/moderation-operation blockers remain; this feature batch does not establish store readiness.
