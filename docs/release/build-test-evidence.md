# Build and test evidence

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

Date: 12 October 2026, Asia/Kolkata. Environment: Linux, Node24.19.0, Java21.0.12.1, Gradle9.3.1 downloaded in /tmp; isolated Android SDK36/build-tools36, NDK27.1.12297006. No local macOS/Xcode. Framework/dependency versions and limits are in readiness.md; full resolved trees in evidence/. Baselines: mobile HEAD abd957166519f26f8ff0a0132bec32adc2078be4; backend HEAD a73d366b1d08685644421a5f0bd2ea84a37a8d68, both with pre-existing and new uncommitted changes. Tests apply to the working tree, not untouched HEAD.

## Commands and observed outcomes

Run mobile commands from paymi_v2, backend commands from product-A-backend unless stated. Actual successful command exit codes for final mobile checks are in evidence/validation-results.json. Empty success logs alone are not the evidence.

| Command | Executed? / result | Artifact / evidence |
| --- | --- | --- |
| node node_modules/typescript/bin/tsc --noEmit | Yes, exit0 | evidence/typecheck-final.log, validation-results.json |
| node node_modules/eslint/bin/eslint.js . | Yes, exit0, no remaining lint findings | evidence/lint-final.log, validation-results.json |
| node --import ./scripts/register-ts-hook.mjs --test --test-isolation=none tests/shop-tools.test.mjs tests/supermarket-isolation.test.mjs | Yes,6 passed | evidence/mobile-tests.log |
| node node_modules/prisma/build/index.js generate | Yes, local client regenerated; version mismatch warning recorded | evidence/prisma-generate.log; no database mutation |
| TEST_DATABASE_URL=postgresql://paymi_release@127.0.0.1:55441/paymi_release_test node --test --test-concurrency=1 tests/*.test.js | Yes,95 passed,0 failed,1 skipped | evidence/backend-regression-final.log; disposable local PostgreSQL only |
| EXPO_PUBLIC_ENV=PRODUCTION node node_modules/expo/bin/cli export --platform all --output-dir /tmp/paymi-release-export | Yes, exit0; Android/iOS JS+assets and static web generated | /tmp/paymi-release-export; evidence/expo-export.log. Expo emitted a forceful-exit notice after export; investigate CLI shutdown before relying on unattended CI |
| EXPO_PUBLIC_ENV=PRODUCTION node node_modules/expo/bin/cli config --type introspect --json | Yes, earlier batch | evidence/expo-introspect-final.json; final Android merge supersedes earlier Android permission list |
| EXPO_PUBLIC_ENV=PRODUCTION node node_modules/expo/bin/cli prebuild --no-install (isolated copy) | Yes, initial Android+iOS generation succeeded | /tmp/paymi-release-native; evidence/prebuild.log |
| EXPO_PUBLIC_ENV=PRODUCTION node node_modules/expo/bin/cli prebuild --no-install --platform android (isolated copy) | Yes, final permission/backup config regenerated | evidence/prebuild-final.log |
| ./gradlew :app:bundleRelease --offline --no-daemon | Yes, failed before app build: foojay resolver plugin not cached | evidence/android-bundle-attempt.log; no AAB |
| sdkmanager --sdk_root=/tmp/paymi-release-sdk 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools' | Yes, downloaded free temporary build tools; existing SDK not modified | evidence/android-sdk-install.log |
| ANDROID_HOME=/tmp/paymi-release-sdk ANDROID_SDK_ROOT=/tmp/paymi-release-sdk GRADLE_USER_HOME=/tmp/paymi-release-gradle EXPO_PUBLIC_ENV=PRODUCTION ./gradlew :app:bundleRelease --no-daemon --max-workers=2 | Online attempts interrupted before final AAB; completion attempt also interrupted | evidence/android-bundle-online.log, android-bundle-resumed.log, android-bundle-final.log, android-bundle-completion.log |
| Same environment, ./gradlew :app:processReleaseMainManifest --no-daemon --max-workers=2 | Yes, BUILD SUCCESSFUL,38s | evidence/android-manifest-final.log; android-merged-manifest-final.json |
| xcodebuild archive / archive validation | Not executed: no macOS/Xcode/signing environment | BLOCKED; no .xcarchive or IPA |
| eas build --platform ios/android --profile production | Not executed: cloud costs/signing/version/console gates unresolved | No new EAS artifact; only historical build-list/account read performed |
| eas submit / console submit/release | Not executed; requires separate authorization after checks | No upload/submission/publication claim |
| git diff --check in both repositories | Yes, pass | evidence/mobile-diff-check.log and backend-diff-check.log |

Initial Node native-TypeScript runner failed because this Node build lacks type stripping. Some sandbox wrappers initially returned only a filename or no actual child output; these are not counted as passed checks. The compiler-backed loader plus test-isolation=none executed the six actual mobile tests. Real integration/CLI checks used the permitted local execution environment; preserve the failed/baseline logs for context, but use final logs for verdicts.

## What the automated tests establish

Backend 95 passes cover existing cross-shop/company/employee authorization, default/selected supermarket persistence, migrations, list/stock/task/operational record behavior, session reset/logout/revocation, bearer-vs-cookie identity, global/direct/team chat access, new report/block/moderation and private-upload cases, free access after expired trial, and deletion for customer/employee/admin. New migration test downgrades only the disposable schema then executes the four real release SQL migrations and verifies retained IDs/password hashes/ownership/tasks.

Deletion tests use synthetic local accounts/files: password/confirmation required, another user ID cannot choose the subject, duplicate requests share a job and rotate the private receipt, unauthorized queue access rejected, own messages/files removed, shared shop/co-owner/staff/task/list preserved, old tokens rejected, file failure stays retryable, former employee can request deletion without shop access, status stays EXTERNAL_REVIEW until actual external checks. They do not test production SMTP/backups or a completed all-processor erasure.

Chat tests cover explicit community agreement, unauthorized reports/queue access, report reuse, block ownership, direct-chat prevention, history/summary filtering, live socket filtering, removal, attachment ownership/private access and rejection of client-forged socket messages. There is no automated content classifier or verified moderator staffing.

Mobile 6 tests cover temperature/money-date input risks, account+shop cache key isolation, default preference not granting access, pending writes blocking shop switch and stale response generations. They are pure tests, not installed-device UI tests. The full suite conditionally skips the slow-database lifecycle test when TEST_DB_LATENCY_MS is unset. It was then run separately with TEST_DB_LATENCY_MS=100 and passed (35.7s total), after restarting the disposable database stopped by interruption. The initial setup failure is retained as backend-latency-setup-failure.log; the successful run is backend-latency.log. This is database latency evidence, not a mobile slow-network test.

## Native configuration evidence

Final Android merged manifest: package com.n1sh.paymi, local versionCode 2, minSDK 24, targetSDK 36, cleartext=false, allowBackup=false. Permissions: INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, CAMERA, MODIFY_AUDIO_SETTINGS, VIBRATE and the app's signature-level dynamic-receiver permission. Only MainActivity and AndroidX ProfileInstallReceiver are exported in the inspected merge; validate their protection/intents in the final packaged artifact. No camera required-feature filter was present. Biometric/fingerprint/wake-lock permissions appeared through dependencies in the earlier merge and were then removed through maintained Expo config. Audio recording, broad storage/media, overlay and FGS permissions remain blocked. Network/audio/vibration permissions support connectivity, scan/task sounds and haptics; no sensitive runtime prompts for them were added.

iOS introspection removed microphone and Face ID usage requests, background audio and broad ATS exceptions for release. Camera/photo strings explain shop scanning/attachments. Still inspect the final built plist/entitlements and archive SDK privacy files; introspection does not prove an archive accepted them. Android backup is disabled to reduce restoration of private local caches; iOS filesystem/backup and legacy local label restoration remain unverified.

## Mandatory installed-candidate matrix — NOT TESTED unless explicitly stated

| Area | Required devices / steps | Expected outcome / missing evidence |
| --- | --- | --- |
| Fresh install and offline launch | iPhone+iPad, Android phone/tablet; current OS and representative minimum-supported version; Metro off | Bundled JS/assets, production services, no dev-client/local host; device logs/screenshots missing |
| Auth/session/account switch | Each role, recovery delivery, wrong/expired/revoked credentials, foreground/background/process death | Correct access; no old user's data; backend cases pass but device/SMTP behavior NOT TESTED |
| Upgrade | Install actual published build then candidate, preserve data, sessions, drafts and any discovered paid entitlement | Listing/published binary unknown; BLOCKED, including ambiguous legacy label keys |
| Workspace critical workflows | Every enabled tool and role; cross-shop API probes, exports/uploads/admin access | Backend fixtures pass; end-user navigation/device evidence absent |
| Offline/slow/server failures | Airplane mode, timeout,500/503, interrupted requests, queued writes, relaunch | Retry safely, no wrong-shop replay; device matrix NOT TESTED |
| Permissions | Camera/photo granted, denied, restricted, revoked, limited/unavailable; scan/manual entry | Manual path implemented; actual OS outcomes NOT TESTED |
| Printing/sharing | System print PDF, cancellation, supported printer disconnect/reconnect | No Bluetooth SDK; supported actual hardware not supplied; NOT TESTED |
| Chat/safety | Rules, report/block/unblock, removal, inaccessible photos, callbacks after switch | API/socket tests pass; release-device controls and operation NOT TESTED |
| Deletion | Disposable account, repeat, old token, web without reinstall, all processors, restored backup, queued writes | Local worker tests pass; complete deployment/processor/restore evidence BLOCKED |
| Navigation/layout/accessibility | Small/large screens, text scaling, VoiceOver/TalkBack/focus/contrast, safe areas/keyboard, Android edge-to-edge/back | NOT TESTED; do not claim accessibility labels alone establish support |
| Links/notifications | paymi:// deep links; mailto/news links; socket/task/expiry mail; notification refusal if newly added | No push service found. Actual links/permissions/notification delivery NOT TESTED |
| Native binary/performance | ARM64/other supported ABIs,16KB device, startup/offline, memory/crashes/ANRs | AAB/IPA and device evidence incomplete; lint/typecheck cannot substitute |
| Privacy | Before-login/consent network trace, SDK destinations, refusal, diagnostic redaction, public URLs | NOT TESTED live; declarations remain drafts |
| Store testing | TestFlight feedback and Play pre-launch/testing reports | BLOCKED: no new uploaded candidate or console reports |

For every future run, append: date/time zone, device/model/OS, version/build, source commit+artifact SHA256, scenario/steps, expected/actual, status and screenshot/log paths. Never replace a NOT TESTED row with PASS based on another platform or a JS-only test.

Latest Android bundle completion: **INTERRUPTED before an AAB was produced**. All attempted native build commands and partial output are retained; no successful bundle build is claimed. Do not submit any temporary generated bundle: it uses the template's debug signing and local versionCode 2 until existing production identity/counters are verified.

Final safety follow-up: accountDeletion.test.js + chatSafety.test.js rerun after the final upload-ownership/transaction fix; 13/13 passed; see evidence/deletion-chat-final.log. The full suite has95 passes plus one conditional skip; the skipped latency scenario passed separately. Source and production export hashes are saved in evidence/source-sha256.json and export-sha256.json. Public URL HEAD results are in public-url-checks.json (HTTP403, not reviewer reachability).

Store-console access was checked through the available browser inventory: no enabled browser/app sessions existed. See evidence/console-access.json. This does not establish whether Paymi has an existing listing.

## Refinement verification (13 October)

See evidence/moderation-validation.json for executed commands, exit codes, test counts and logs, and evidence/moderation-source-sha256.json for the changed source snapshot. No native build command, store upload or submission was executed in this refinement batch; owner handles builds. No .aab/.ipa represents this source. Earlier artifacts remain historical.
