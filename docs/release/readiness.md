# Readiness and product inventory

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

Checked 12 October 2026. **Both stores BLOCKED.** No upload, approval or publication is established. EAS reports historical successful iOS builds (most recent inspected: 1.1.0/29, 8 October); this does not establish a live listing or validate the new source.

## Confirmed scope

Kaliam operates Paymi; support/privacy contact is support@paymi.co.uk (owner supplied, mailbox delivery not tested). A free business workspace for shop owners and employees aged 13+. UK public distribution; India testing only. No subscriptions or billing in this release. Public availability does not confer shop access. Existing listing status and rejection text remain owner inputs. Keep com.n1sh.paymi for iOS and Android and the existing EAS project. Never create replacement listings or reset signing/data.

One Expo CNG React Native mobile project, paymi_v2, serves both platforms. Expo 57.0.25, RN 0.86.3, React 19.2.3, TypeScript 6.0.3 resolved locally. No maintained native directories; configuration lives in app.json, app.config.js and eas.json. Node 24.19.0. Exact Expo v57 docs were read as required by AGENTS.md. The support baseline is Xcode 26.4+, iOS 16.4+, Android min API 24 / compile+target 36; final native artifacts still require inspection.

product-A-backend is the existing Express/Prisma service, Neon PostgreSQL, Redis/memory fallback, filesystem uploads, Socket.IO and SMTP. fornt-end-save is the existing web/admin client, not a separate mobile product. Resolved Prisma CLI/client versions differ (6.2.1 / 6.4.1); pin/alignment needs a separately validated lockfile change before reproducible deployment. No new backend was created. CI evidence is absent in the inspected repositories.

## Reachable feature inventory

| Feature / navigation | Data, access and behavior | Evidence / remaining concern |
| --- | --- | --- |
| Login, registration email OTP, recovery OTP, logout | Email/password only; customer, employee and admin tables. SecureStore native; browser fallback local storage. No OAuth/social provider. | authService, auth controller, accessControl; new durable logout revocation and version invalidation tests |
| My Supermarkets / workspace selection | Owner CUSTOMER ownerships; EMPLOYEE active shop membership and tool read/write/edit permissions; ADMIN/company permissions separate. Selected-shop header checked on server. | Existing multi-shop work preserved; authorization/default/migration suites |
| Lists, collect, catalogue search, compare, barcode quick-add, price reporting | Shared shop lists/stock, supplier product catalogue, reports, points and export. No checkout or transfer of money. | Protected REST and scoped offline queues; catalogue provenance/rights unresolved |
| Tasks, employee management | Owner assignment; employees see permitted jobs. Company staff are a separate role. | Existing role suites; all enabled features need device coverage |
| Expiry, fridge/freezer temperatures, cleaning | Operational records and staff attribution; in-app sounds/toasts and backend mail reminders. | No push permission/service in mobile; physical safety reliance must not be overstated |
| Incidents, age-restriction records, waste | Free text, photos, child-gender field in legacy age records, attribution and shop data. | Sensitive third-party data; minimize entries, approve organization retention and youth safeguards |
| Supplier payouts, shift sheets | Amounts, cash/card totals and names entered as records; no payment processor or banking integration. | Do not market as a money-transfer service |
| Certificates | Shop documents/photos, expiry and provider/premium details. | Authenticated downloads and shared-record deletion review |
| Chat | ALL Chat, team and direct chat, text/images, document metadata, shared lists. Current directory includes other owners and support accounts. | Non-blocking rules, reporting, blocking and Admin review/restrictions/removal implemented; filtering and real moderation operation remain blocked |
| Labels | Device-local drafts, saved layouts, print history, PDF generation; system print/share, scan/manual search. | No Bluetooth printer implementation. Legacy storage key lacks role type; migration/isolation remains a release finding |
| VAT and profit calculators | Standalone arithmetic on device | No account dependency in isolation; no guest change made |
| News, promotions, banners | Remote editorial/product images and links, advertised offers | Declare ads conservatively; review live inventory, licences, link destinations and age-restricted material |
| About, support, recovery, deletion, chat safety | Public entry points before sign-in, without opening private workspace data | Full approved privacy/terms and live URL checks still required |

No mobile payment/ads SDK, analytics/crash SDK, push registration, background location, contacts, microphone recording or generative AI feature was found. Backend image background removal exists; inspect its actual runtime/model fetch and any legacy remove.bg integration before declaring processor behaviour. No custom WebView component was found; expo-web-browser/external link destinations still require review. OTA updates are disabled; no runtime update service was enabled. paymi:// deep-link routing exists; no OAuth callbacks/universal-link association established.

## Highest release blockers

1. No signed, validated new iOS archive or Play AAB; real release-device and upgrade matrix unexecuted, 16 KB ABI/page-size evidence missing.
2. Deletion worker is local code only. Shared-record references, provider logs/mail/backups, restore erasure and deployed scheduling have not been verified. No public deletion URL verified live.
3. 13+ chat needs content filtering, named moderation/escalation operation and a youth/privacy assessment. Report/block code alone is not a complete UGC programme.
4. Complete privacy/terms, separate store declarations, content ratings, content rights and real support delivery are unverified. Sensitive records can describe other people, including children.
5. Existing store status/rejection/signing/console eligibility unknown; no dedicated reviewer accounts or clean-install review evidence.
6. Outstanding engineering findings: legacy label keys lack account type; offline access may use cached identity after remote revocation until online validation; server logs and legacy caches need comprehensive personal-data redaction/erasure verification; registration/reset rate limits use memory fallback and must be checked in distributed deployment. Do not claim all backend routes or third-party SDK behaviour were penetration-tested.

## Implemented changes in this batch

- Production EAS profiles select production services, bundle AABs, reject local/non-HTTPS release endpoints and prohibit broad cleartext/ATS exceptions.
- Removed unnecessary microphone/audio background, broad storage/photo, biometric/fingerprint, wake-lock and overlay/foreground-service permissions; disabled Android backup. The final merged Android manifest confirms the removals. Camera refusal has manual barcode entry and a settings path.
- Tokens no longer fall back to a known signing secret; bearer takes precedence over stale cookie; durable logout digests and session-version resets revoke sessions/sockets; account lookup outages are service errors rather than false token expiry. Login handles case-insensitive email. Added authentication throttling and generic credential errors.
- Free-release access bypasses legacy trial gates without deleting historical entitlement columns or introducing billing.
- Chat attachments are authenticated, sender-owned and protected from static-file bypass. Client-forged socket messages are no longer relayed. Background chat notifications carry an invalidation hint instead of message content. Directory email exposure reduced.
- Personal deletion requests, password reauthentication (including departed staff), private receipts, durable stages/retries, shared-record attribution cleanup and operator review tooling. Shared workspaces/staff are preserved; no automatic staff promotion.
- Non-blocking community information, reporting, blocking/unblocking, filtered histories/summaries/live messages, admin report review and removal. No third-party content-screening service added without an evaluated provider.
- Pre-login information/support/deletion routes, real contact, accessible input labels and explicit message report button. React form resets and product searches adjusted to avoid stale asynchronous results and compiler lint errors.

## State boundaries

Implemented and locally tested does not mean deployed. Public resources exist in product-A-backend/public/release and router code; hosting is BLOCKED. Privacy policy and terms remain drafts because retention/processor/legal facts are incomplete. See build-test-evidence for exact outcomes; JS bundling is not archive validation. No numeric compliance score or approval guarantee applies.
