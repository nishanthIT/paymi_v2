# Product images, team chat and chat camera — 23 October 2026

Implemented in `paymi_v2` and `product-A-backend`. Automated checks pass as recorded below. **Installed-device testing and verification of live client memberships remain incomplete, so this is not a Google Play resubmission sign-off.** No deployment, production data changes, signed native build, or store submission was performed. Existing `.env`, supplier-import and Prisma-schema edits were preserved.

## Changes

- Product images now use one shared `ProductImage` component across lists, search, detail sheets, Collect Mode, employee lists, comparison, promotion products, expiry and label pickers. It normalizes relative URLs and serialized image metadata, tries available supplier/EAN/barcode sources, and displays the bundled PayMi logo while loading or when every source fails. A preview opens only a successfully loaded image. Recycled rows reset their image state. Label catalogue mapping retains all image candidates.
- Team rosters already use verified shop ownership and active employee memberships, independently of tool permissions. The defect found was that background notifications used historical `ChatParticipant` rows, omitting legitimate employees who had not posted, and membership changes did not refresh other clients. Notifications now use the same authoritative roster as REST. Create, assign, update, deactivate, reactivate, remove and access-review grants refresh team contacts and rosters. Concurrent first posts use an upsert. Inactive or unrelated accounts still cannot read or join the team.
- Chat clients refresh contacts and conversations on roster events, reconnect and foregrounding; an open thread refreshes its roster as well. Socket.IO can fall back to polling where WebSockets fail. API failures show retry controls. Only the focused thread joins its room and marks messages read; receipt checks distinguish colliding owner and employee IDs.
- The camera button opens an embedded camera without navigating away from chat. It supports front/back cameras, capture, preview, retake, cancel and explicit Send. It handles denied permissions, Settings recovery, startup/capture errors and background/navigation cleanup. Captures explicitly use JPEG. Uploads time out after 60 seconds; failed sends retain the preview, reuse an existing upload and do not become indefinitely paused offline. Web uploads use a Blob; native uploads preserve file/content URIs. Permission descriptions now include chat photos.
- Camera sends carry a stable `clientMessageId`. The backend derives an account-type/account/chat-scoped message ID and serializes retries within a transaction. A lost response can be retried without another message or event, or changing newer chat activity. Conflicting payloads return 409. Author-deleted retryable photos keep a payload-cleared deletion marker in the existing Message table so a delayed retry cannot recreate them; moderation removals are also respected. No new schema migration is needed for these changes. Existing ownership/membership/chat-upload/moderation migrations remain prerequisites.

## Executed validation

All database tests used disposable local PostgreSQL `paymi_chat_test` on port 55443. The harness refuses remote or non-test database targets.

| Check | Result | Evidence |
| --- | --- | --- |
| Full frontend test suite | 65 passed, 0 failed | [Frontend log](evidence/resubmission-2026-10-23/mobile-tests.log) |
| TypeScript, full ESLint, both repository whitespace checks | Passed | [Validation record](evidence/resubmission-2026-10-23/validation.json) |
| Broad backend suite before the final retry protection change | 217 passed, 0 failed, 1 conditional latency test skipped | [Backend regression log](evidence/resubmission-2026-10-23/backend-full.log) |
| Final chat/membership/upload/retry/moderation/account-deletion suites | 35 passed, 0 failed | [Final backend log](evidence/resubmission-2026-10-23/backend-final.log) |
| Production-mode Expo export for Android, iOS and static web | Passed; JS and asset export, not a signed native build | [Export log](evidence/resubmission-2026-10-23/export.log) |
| Expo native configuration introspection | Passed; camera permission present, recording and broad photo/storage permissions remain blocked | [Relevant native config](evidence/resubmission-2026-10-23/native-config.json) |
| Read-only diagnostic against configured backend database | Failed to connect: `ETIMEDOUT`; no live shop findings obtained | [Validation record](evidence/resubmission-2026-10-23/validation.json) |
| Connected Android devices | None found by `adb devices -l` | Physical-device checks below remain unexecuted |

The final backend scenarios cover owners, active employees with no tool permissions, administrators, company-only staff, unrelated shops, inactive members, employees in multiple shops, missing historical participant rows and two simultaneous Socket.IO clients. They exercise real multipart JPEG upload, IMAGE message save/read, byte-for-byte private file download, authorization after revocation, concurrent sends, unchanged history, duplicate-safe retries and deletion. Two socket clients simulate device sessions; they are not physical-device tests.

Frontend tests cover image callbacks with mocked native images, URL/metadata variants, gallery/native multipart formats, preview/send retry logic, cache isolation, reconnect invalidation, offline mutations and typed read receipts. They do not establish native camera rendering, operating-system permission behavior or crash/ANR rates. Expo reported its existing forceful CLI shutdown notice after successful export; exit code was 0. The final export includes the supported Expo Router focus hook and does not bypass router compatibility checks.

## Live diagnostic and remaining release checks

From `product-A-backend`, `node scripts/inspectShopTeamChats.js` checks all customer shops; `--shop-id=<id>` restricts it. It uses a read-only transaction and returns relationship IDs, statuses and counts without names, emails or messages. Missing chat links or legacy pointers without verified memberships require review through the existing shop/access workflows; the diagnostic does not create chats or grant membership. Run it where the configured database is reachable, then verify any affected client through its authorized account.

Deploy the backend changes before validating the new app candidate. On the actual Android release candidate, test at least a small-screen phone and another representative Android version/device, plus a tablet if supported. Repeat as owner and employee, including separate shops and multiple sessions. For supported iOS releases, repeat on iPhone/iPad as well.

| Device scenario | Expected behavior | Status |
| --- | --- | --- |
| Valid, absent, 404 and offline product images; scroll/recycle rows and open previews | Correct photo or PayMi logo, no blank boxes or wrong-product preview | Not run on devices |
| Add/assign/remove/revoke an employee from another account; reconnect, background, switch shop/account | Current authorized roster on every session; no other shop's contacts/messages | Not run on devices/live clients |
| Camera grant, deny, permanent denial/Settings return, front/back capture, cancel and Android back | Usable controls, camera released on exit, return to same conversation | Not run on devices |
| Preview/retake/send, slow or interrupted upload, lost response, offline retry, double tap | Preview retained on failure, one successful photo, correct sender and recipient | API/logic tested; device run pending |
| Small/large text, keyboard, safe areas, scrolling, TalkBack, process restart and release logs | No clipped or unusable controls, crash or ANR | Not run on devices |
| Signed candidate and Google Play internal/pre-launch testing | Candidate includes both fixes and current backend behavior; reports reviewed before resubmission | Not run |

Implementation references: [Expo SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [Expo Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [Socket.IO transport options](https://socket.io/docs/v4/client-options/). Source fingerprints and machine-readable validation are saved alongside the logs.
