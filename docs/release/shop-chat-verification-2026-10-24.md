# Shop chat and camera verification — 24 October 2026

The frontend and backend fixes are implemented and the checks below passed. Android runtime verification used Expo Go on a disposable emulator with synthetic accounts and a local API. **Production migration/deployment, signed Android release testing and native iOS testing remain outstanding. This is not a store resubmission sign-off.**

No production data was changed. The configured database was inspected in a read-only transaction. Existing `.env` and unrelated supplier-import changes were preserved. This report supplements the [23 October report](chat-images-camera-2026-10-23.md); its upload implementation and verification results supersede that report where noted.

## Root causes and changes

| Finding | Implemented correction |
| --- | --- |
| The contact API included customers outside the selected shop and company administrators. A separate rule explicitly prevented employee-to-employee DMs. Historical participants could retain access without a current membership. | One shared backend policy now requires a verified owner or ACTIVE employee membership in the selected CUSTOMER shop. Directory, search, participant lists, chat reads, sends, read receipts, deletion, uploads and private attachment access use this policy. Employee DMs are enabled within that boundary. Company-only staff, suppliers, unrelated shops and broad administrator roles do not grant shop-chat access. A company employee with an explicit ACTIVE shop membership remains eligible. |
| Conversations had no durable shop association. Checking a pair before creation could race with another request. | Additive `Chat.shopId` migration and a transaction/advisory lock keyed by shop and typed participant pair. Concurrent and reverse requests reopen one existing eligible DM. Existing duplicate histories are not merged or deleted. |
| Team notifications depended on stored participant rows, which omit employees who have never posted. Existing socket rooms could outlive authorization. | Verified shop ownership and current memberships drive the roster and notifications. Membership changes, reconnect and foregrounding refresh clients. Message/typing/deletion broadcasts revalidate each receiving socket's session, selected shop and chat access before delivering private data. |
| Old categories and cached global contacts conflicted with shop-only chat. | Two primary tabs: All Chats and Team Chat. New Chat searches eligible shop teammates. New cache namespaces prevent old global directories being reused; blocking and access-denied events clear the appropriate caches. Existing authorized group and direct histories remain available. |
| Camera controls did not reliably accommodate modal safe areas or permit closing during pending work. | Modal-local safe-area provider, bounded preview, fixed-size visible X and non-shrinking controls. X and Android back close the camera; capture completion cannot reopen it. Closing cancels pending uploads and preserves the conversation's text draft. Preview, retake, permission recovery and retry remain supported. |
| Actual Android photo upload failed despite mocked multipart tests: SDK 57's native fetch rejected the legacy `{ uri, name, type }` part with `Unsupported FormDataPart implementation`. | Native multipart now uses a byte-readable `expo-file-system` File. Added a regression using the installed Expo FormData patch and converter. A real emulator capture subsequently uploaded, persisted and downloaded successfully. Web continues using a Blob. |

The shared product-image component and fallback changes from 23 October remain in place. Native Android product search was additionally verified to display the bundled PayMi logo for the missing-image fixture.

## Automated checks

Database tests ran against disposable local PostgreSQL databases. The test harness refuses remote or non-test database targets.

| Check | Result | Evidence |
| --- | --- | --- |
| Full backend suite | 223 passed, 0 failed, 1 optional latency test skipped | [Backend log](evidence/resubmission-2026-10-24/backend-tests.log) |
| Final shop isolation and migration suite after adding the dangling-chat repair | 5 passed, 0 failed; these scenarios are also part of the full suite | [Final migration/isolation log](evidence/resubmission-2026-10-24/shop-isolation-final.log) |
| Full frontend suite after the native upload fix | 71 passed, 0 failed | [Frontend log](evidence/resubmission-2026-10-24/frontend-tests.log) |
| TypeScript and full ESLint | Passed after the native upload change | [Validation record](evidence/resubmission-2026-10-24/validation.json) |
| Both repositories' `git diff --check` | Passed | [Validation record](evidence/resubmission-2026-10-24/validation.json) |
| Production-mode Android, iOS and static web export | Passed; JavaScript/assets only, not signed native binaries | [Export log](evidence/resubmission-2026-10-24/export.log) |

The backend scenarios exercise owners, employees without tool permissions, company-only staff, company staff with an explicit shop membership, suppliers, administrators, inactive employees and employees belonging to multiple shops. They cover forged participant identities, alternate selected-shop headers, unauthorized reads/sends/receipts/deletions, stale participant rows and socket subscriptions, two-way messages, duplicate/reverse DM creation, private JPEG download, membership removal/restoration and history preservation during migration.

Frontend tests execute camera controls for Android and iOS platform branches using mocked native views, including X/back during permission denial, capture and sending. These are component tests, not an iOS simulator run. Upload tests include SDK multipart conversion, cancellation, retry and duplicate suppression. Image tests cover missing/broken candidates, successful fallback, recycled rows and preview state. Expo completed export with exit code 0, then printed its CLI forceful-shutdown notice.

## Native Android verification

Environment: Android 14/API 34 Pixel 7 AVD, Expo Go 57.0.9, real installed application JavaScript, local Express/Socket.IO API and disposable PostgreSQL. Tested at 1080 × 2400 / density 420 and 720 × 1280 / density 320 (360 × 640 logical). These are two viewport configurations of one emulator, not two physical devices.

| Scenario | Observed result |
| --- | --- |
| Employee with no other tool permissions | All Chats and Team Chat available; team roster includes owner and both active employees. New Chat excludes self and lists only the other employee and shop owner. |
| Start and reopen employee DM | New Chat creates the DM; reopening/reloading retains the same conversation and messages. |
| Camera denial, X and Android back | Returns to the same thread with the existing text draft. |
| Camera permission grant, capture, preview and retake | Camera starts, controls remain visible, capture opens preview and retake returns to the live camera. |
| Photo send and recipient verification | Camera JPEG uploaded and saved; recipient downloaded the 16,138-byte JPEG through the authorized API. Recipient reply arrived live in the employee's Android thread. Text draft remained intact and could then be sent. |
| Small-screen layout | X sits below the top safe area; shutter and preview buttons remain above bottom navigation. [Camera](evidence/resubmission-2026-10-24/android-small-camera.png), [preview](evidence/resubmission-2026-10-24/android-small-preview.png). |
| Close during stalled upload | Paused only the synthetic API, started Send, pressed the still-enabled X, then resumed the API. Returned to the thread with the draft; message count stayed unchanged and no second image was sent. [Sending](evidence/resubmission-2026-10-24/android-sending.png), [cancelled](evidence/resubmission-2026-10-24/android-cancelled.png). |
| Owner account | All Chats includes the shared team but excludes the employees' private DM. New Chat lists only Alice and Bob. Owner's Android team message was readable by the employee API session. [Picker](evidence/resubmission-2026-10-24/android-owner-picker.png), [team message](evidence/resubmission-2026-10-24/android-owner-team-message.png). |
| Missing product image | Search result displays the PayMi logo, not a blank box. [Screenshot](evidence/resubmission-2026-10-24/android-product-placeholder.png). |

The camera's captured black image with yellow timestamp is the emulator's synthetic JPEG, not a failed preview or physical-camera quality test. The floating gear in some screenshots is Expo Go's development overlay. No app crash was observed during these scenarios; this is not crash/ANR certification.

## Read-only configured-database audit

`node scripts/inspectShopTeamChats.js` successfully inspected all 10 customer shops: 9 active shop-employee memberships and no legacy employee pointers lacking a membership. It found:

- One dangling canonical team-chat link with a verified owner: shop `cmn46ab150000caqgiupay5bk`, chat `cmn46adsk0001caqg9w2n8p89`. The new migration restores the missing Chat at that same ID only if it is uniquely linked, still missing and the shop has verified ownership or active staff. It does not replace an existing record.
- One shop with no verified owner and no employee memberships: `cmmwocwrc0000cai8w2o71la0`. Its existing history is preserved, but a stale participant is not proof of authorization. If this shop is intended to remain active, ownership/membership must be resolved through the existing verified access workflow. No owner or access grant was invented.
- Stale participant rows in two shops. They remain stored as history and no longer grant access or populate current participant lists.

A sanitized count summary is saved in [validation.json](evidence/resubmission-2026-10-24/validation.json). The audit did not write to the configured database. The prepared migration has only been executed against disposable test data.

## Deployment and remaining release verification

Deploy the backend with `product-A-backend/prisma/migrations/20261024100000_shop_chat_scope/migration.sql` applied and the Prisma client generated before distributing this app update. The migration preserves every existing message and participant, scopes only unambiguous shop histories, excludes the legacy global chat and leaves ambiguous histories stored but inaccessible pending explicit relationship review. It must not be replaced with a destructive schema reset.

After deployment, rerun the read-only diagnostic and verify the repaired shop through its authorized account. Resolve the ownerless shop only if it should be active; no legitimate ownership can be inferred from its stale chat row.

Still required before resubmission: native iOS/iPhone/iPad checks on a macOS/Xcode host where supported; physical Android testing of the signed release candidate, including hardware camera and permission Settings recovery; representative accessibility/text-size/rotation checks; and Google Play internal/pre-launch results. Product-image offline/404/valid-supplier cases have automated coverage but only the missing-image case was exercised in this emulator run. No production deployment or Google Play submission was performed.

SDK references: [Expo 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [Expo FileSystem upload guidance](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/#uploading-files-using-expofetch), [Expo fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/#expofetch-api).
