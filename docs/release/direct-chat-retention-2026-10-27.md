# Direct messaging verification — 27 October 2026

Personal conversations now open immediately into a cancellable loading screen, reuse cached/existing rooms, and deduplicate repeated opening requests. Live events update inbox previews, unread counts and delivery/read ticks on every connected device. Reconnect reconciles missed messages through the existing APIs. Foreground alerts open the relevant conversation; terminated-app push notifications are not implemented.

The four chat sections, Global Chat, private shop teams, participant eligibility, message actions, attachments and history remain in place. Browser verification found nested HTML buttons in conversation options and message actions. Both now use independent sibling controls, retaining native long-press behavior and desktop actions.

## Executed checks

- Backend: **292 passed, 1 optional skipped, 0 failed** on disposable local PostgreSQL. Includes concurrent room creation, stale/revoked accounts, supplier restrictions, cross-server Redis delivery, receipts, shared files, UTC retention boundaries, migration preservation, storage retries and uncertain uploads.
- Frontend: **142 passed, 0 failed**; TypeScript and targeted ESLint passed.
- Production bundle exports: Android, iOS and web passed. These are compilation checks, not physical-device certification.
- Chromium end-to-end: retail owner at 1440px and retail employee at 390px, with the actual application, API and disposable database. Verified Global Chat → personal conversation, unread inbox, live replies/read receipts, message search, camera close/draft preservation, capture/preview/upload/private image loading, explicit offline state/reconnect and New Chat reuse of the same room. No page errors or nested-button/hydration errors were recorded.

Evidence is in [evidence/direct-chat-retention-2026-10-27](evidence/direct-chat-retention-2026-10-27). Screenshots contain synthetic test accounts only. No test fixture is added to the production app.

## Reproduce the browser flow

Use a disposable **local database with `test` in its name**. The backend helper refuses other database URLs and resets only that database. Never use a shared staging/production database.

Start the API fixture from `product-A-backend`:

```sh
PAYMI_BROWSER_FIXTURE=1 TEST_HTTP_PORT=3107 \
TEST_DATABASE_URL=postgresql://TEST_USER@127.0.0.1:TEST_PORT/paymi_chat_test \
node tests/helpers/chatBrowserFixture.js
```

Start a separate development server from `paymi_v2`, leaving the user's `.env` unchanged:

```sh
EXPO_PUBLIC_ENV=LOCAL EXPO_PUBLIC_LOCAL_IP=127.0.0.1 \
EXPO_PUBLIC_LOCAL_PORT=3107 CI=1 \
node node_modules/expo/bin/cli start --port 8088 --localhost --clear
```

With Chromium installed and `playwright-core` available, run:

```sh
PAYMI_BROWSER_ORIGIN=http://localhost:8088 \
PAYMI_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
node tests/browser/chat.e2e.mjs
```

The browser harness blocks non-local HTTP destinations. It uses a synthetic camera stream; native camera permissions, hardware back behavior and actual Android/iOS devices still require release QA. Stop both test processes afterwards. CI mode disables Metro file watching, so restart it after source changes.

## Deployment state

The backend is hosted at `/var/www/product-A-backend` on the DigitalOcean `vino` Droplet, managed by PM2. Deployment steps, storage settings, guarded migration and worker supervision are in the [backend rollout guide](../../../product-A-backend/docs/chat-direct-retention-2026-10-26.md).

The additive migration was applied to the configured database and preserved 37 chats, 68 messages and 83 participants. No live retention deletion was run. Local retention is disabled because the real attachment volume is on the Droplet. The Droplet code, actual PM2 process/startup integration and real cloud bucket have not been verified through SSH. Complete deployment and physical-device QA before store resubmission.
