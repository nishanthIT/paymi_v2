# Expo Go startup route — 25 October 2026

The reported `exp://192.168.1.188:8081/--/` launch resolves to the protected home route. Before session restoration finished, the root layout treated the user as signed out and allowed Expo Router to redirect immediately. With SDK 58, the default guard destination was `/(auth)`, but that group has no index screen. The installed SDK's parser confirms that this destination resolves to `+not-found`, reproducing the screenshot. The previous compilation and manifest checks did not exercise this guard redirect.

The root layout now waits for session restoration before mounting navigation and explicitly redirects signed-out users to `/(auth)/login`. Authenticated users visiting authentication screens go to `/(app)/(tabs)`. The existing splash stays mounted while restoration runs. Existing routes and genuine not-found behavior are preserved.

## Verification

- Seven new regression cases failed before the fix and pass afterward. They exercise the actual root layout, installed SDK route parser and guard context against the application's route files, with native rendering/provider dependencies substituted.
- The cases cover pending restoration and iOS, Android and web route configurations: the exact reported Expo Go URL, signed-out launch/logout, login/restored sessions, chat deep links and the public chat-safety page.
- Full frontend suite: **80 passed, 0 failed**.
- TypeScript (`node node_modules/typescript/bin/tsc --noEmit`), ESLint (`node node_modules/eslint/bin/eslint.js .`) and `git diff --check` passed.
- Production JavaScript/assets exported successfully for iOS, Android and static web using `expo export --platform all`.

Logs are in [evidence/routing-2026-10-25](evidence/routing-2026-10-25/). These are routing integration and compilation checks, not native device end-to-end verification. No connected browser or native iOS device/simulator was available for this check. The temporary Metro verification server was stopped afterward.

## Reload the fix

Stop the old Metro process with Ctrl+C. From `paymi_v2`, run:

```sh
npx expo start --go --clear
```

Fully close and reopen Expo Go on the iPhone and scan the new QR code. Confirm signed-out launch reaches login, a restored session reaches home, logout returns to login and an authorized chat link opens its conversation.

SDK behavior references: [SDK 57 to 58 Router migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/), [protected routes](https://docs.expo.dev/router/advanced/protected/), [SDK 58 Router API](https://docs.expo.dev/versions/v58.0.0/sdk/router/).
