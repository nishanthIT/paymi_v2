# Global Chat restoration — 26 October 2026

The clarified requirement is one shared retail community conversation across shops. This supersedes the earlier requirement that every conversation be restricted to one shop. Private shop teams retain their existing boundaries.

## Behavior

- Global Chat is pinned at the top of All Chats. Existing Team Chat, Direct and Unread filters remain available.
- Verified retail shop owners and active retail shop employees can read, search and post in the same global conversation. Company-only roles, cash-and-carry owners, wholesale-only employees and anonymous clients cannot access it.
- New Chat searches eligible retail owners and employees across shops. In a group conversation, tapping a sender's name opens message actions, including **Message personally** for eligible participants. That action creates or reopens a private conversation shown in Direct.
- A new community direct conversation belongs to its two participants, not their selected shop. Existing valid shop-scoped private conversations are reused when authorized; their history and shop scope remain unchanged.
- Private teams and shop-list sharing retain shop authorization. Global Chat never authorizes sharing a private shop list. Blocks, moderation, attachments, read receipts, retry identities and socket authorization remain enforced.

## Cause and implementation

The backend explicitly hid `ALL Chat`, and the frontend discarded conversations without the selected shop ID. The directory, REST access and realtime checks now recognize the canonical global conversation and eligible private community conversations. The server marks shared conversations explicitly in API summaries; the feed uses those flags while preserving shop filtering for private teams.

Startup reuses the earliest unscoped `ALL Chat` / `Global Chat` that is not linked as a shop's team. It renames that row to Global Chat and retains its ID. A transaction advisory lock prevents duplicate creation on fresh installations. Other legacy rooms and their messages are preserved. Listing and searching conversations remain read-only.

## Existing database

The configured database contained one legacy ALL Chat with 31 messages. Restoration reused its ID and renamed it. Transactional preservation checks confirmed that all 34 conversations, 68 messages and 77 stored participant records remained, and that message contents, participant history and shop associations did not change. Runtime eligibility is derived from current verified memberships, not stale global participant rows.

The local development API on port 3000 was restarted with the changes. The Expo development configuration remains LOCAL; `.env` was not changed.

A read-only check against the configured database verified global access for all 18 eligible account/shop selections, checked directory responses for both owner and employee roles, and confirmed denial for seven excluded accounts. The current eligible roster contains 17 unique retail users. The restarted local API returned HTTP 200 with healthy status.

## Validation

- Frontend: 122 tests passed, including real component logic under iOS, Android and web bindings for global visibility, private-message navigation and draft retention.
- Backend: 247 tests passed; one opt-in latency test skipped. Tests use a guarded disposable local PostgreSQL database and an actual Express/Socket.IO server.
- New integration coverage includes legacy history preservation, concurrent startup, all retail roles across shops, excluded wholesale/company roles, private teams, duplicate direct prevention, cross-shop send/receive, multiple devices, reconnect recovery, membership revocation, blocking and private image access.
- TypeScript and ESLint passed. iOS, Android and static web JavaScript/assets exported successfully.
- Evidence: [verification files](./evidence/global-chat-2026-10-26/).

These are automated platform-binding and API/socket integration checks, not hands-on physical Android/iOS or browser verification. No connected browser or device was available. The hosted production API has not been deployed by this change; it needs the updated backend before a production build can use this behavior.
