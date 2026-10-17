# Privacy and data inventory — working evidence

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

Checked 12 October 2026. Operator/contact are confirmed by the owner: Kaliam, support@paymi.co.uk. All periods in retention-proposal.md are **approved implementation targets, not verified public promises**. No processor contract, backup window, geographic hosting location, legal basis or certification was invented.

## Flows

| Data / source | Destination / processor | Purpose / trigger | Required or optional / linkage | Retention and deletion | Protection / validation |
| --- | --- | --- | --- | --- | --- |
| Email, display name, password at registration/login | Existing API, Neon PostgreSQL; SMTP verification via configured Zoho/mail service | Account and workspace access, registration OTP and recovery | Account credentials required; linked to user. Shop name used for owner provisioning. Existing mobile/phone columns also need legacy/admin-flow review | Password hashes, profile and memberships removed by personal-deletion worker; not deployed | bcrypt, HTTPS release endpoint, SecureStore token; local API tests |
| Employee names/email/phone fields and access grants | API/PostgreSQL, owner/admin UI | Staff provisioning, roles and tasks | Business account records required for staff feature; owners can enter others' details | Membership deletion/creator unlinking implemented; shared tasks preserved | Per-shop and company permissions; cross-role tests |
| OTP and pending registration data | Redis or process-memory fallback, SMTP recipient/provider | Signup/recovery request | Required when used, linked email; not advertising | Code TTL10min, cooldown60s and attempt limit; deployed Redis/SMTP expiry not verified | OTP HMAC in code; delivery/provider retention untested |
| Auth token, cached identity | iOS Keychain / Android secure storage; browser fallback storage | Session persistence and API requests | Required for private access | JWT7days; logout digest retained until expiry; password reset increments session version | Bearer/cookie/old-token tests; device backup/restore not tested |
| IP, request metadata, errors and access history | API host/reverse proxy, platform/provider logs, database admin-access logs | Network delivery/security/diagnostics | Automatic on network use; can identify/link users | 30-day log target unverified; content-bearing legacy console logging still needs comprehensive redaction | Production client log/info suppressed; other diagnostics and crash telemetry unverified |
| Product searches, barcode, lists/stock, price reports/points | API/PostgreSQL, authorized shop/company roles | Lookup, operational collaboration and feedback | User input when feature used; linked lists/reports | Shop records preserved, creator links removed; personal lists deleted; ambiguous legacy/shared references require review | Scoped requests/queues and authorization tests |
| Tasks/assignments, cleaning, temperatures, expiry | API/PostgreSQL; reminder SMTP; device cache | Business records and reminders | Optional features; linked staff/user IDs | Shared history retained pending organization schedule; direct author links anonymized during deletion | Per-feature permissions tested locally; no medical safety claim |
| Incident/age/waste descriptions, photos, child-gender field, attribution | API/PostgreSQL + server uploads | Shop incident and age-restriction recordkeeping | Optional feature content; may identify staff/customers/children and contain sensitive facts | Do not treat shared records as automatically anonymous. Personal free-text/image references require review, not just ID removal | Authenticated incident/age file access; runtime consent/minimization assessment pending |
| Certificates, insurer/provider details, premium, meter readings | API/database/filesystem, authorized shop roles, device export/cache | Shop document management | Optional; potentially personal/financial documents | Shared shop retention undecided; deletion review must inspect documents | Authenticated certificate download; installed-device export cleanup untested |
| Supplier payout and shift amounts, payee names, notes | API/PostgreSQL, authorized shop staff | Bookkeeping only | Optional business/financial records, may link individuals | Shared records preserved; personal attribution anonymized; free text reviewed | No payment card credential, bank transfer or billing processor found |
| Messages, photos and document metadata, chat read receipts | API/Socket.IO/PostgreSQL/filesystem; chat members and Kaliam admins | User communication | Optional feature but tied to account; ALL Chat spans shops | Authored messages and owned attachments erased by worker; reused attachments/shared/processor content reviewed | New authenticated uploads and anti-spoof controls; blocked-peer REST/socket tests |
| Community agreement, blocks and reports | API/PostgreSQL; Kaliam admin moderation queue | Safety/preferences/report handling | Agreement required before posting/uploading; reporting optional, linked user | Acceptance and blocks removed; reporter ID unlinked on deletion. Moderation-note/report retention schedule still undecided | Admin-only queue; no automated filtering service added |
| Label drafts/saved jobs/PDFs and printer/share output | Device AsyncStorage/files and user-selected system print/share target | Label editing/printing | Optional; no label backend identified; business details may identify people | User-controlled local data; library stores up to25 recent jobs. Erasure of exported/share copies and role-safe legacy migration unverified | Existing label keys omit userType; release finding, not a claimed secure migration |
| Product images, remote banners/news/promotions and links | Existing host/image paths and remote vendor/CDN/web destinations | Catalogue/editorial/advertising display; user opens links | Images may load during feature display, transmitting IP/network metadata; linkage by vendor unknown | Vendor cache/log terms unknown; rights and processors require confirmation | No ad ID/analytics SDK observed; no runtime tracking conclusion |
| Image background removal | Backend IMGly dependency, model assets and possible legacy remove.bg integration | Admin/product image operation | Conditional tool input; processor behaviour not observed | Model/network/log retention unknown | Trace real backend path before AI/provider declarations or explicit consent conclusion |
| Deletion job, receipt digest, evidence references | API/PostgreSQL, restricted operator tooling | Durable retries, status, backup-restore erasure | Required for request; linked numeric account/type; receipt is secret bearer for minimal status only | Approved90-day evidence target not scheduled/verified. Do not declare completion until external review evidence | No raw password/session/receipt stored in job; reauth and retry tests |

Legacy migration ledgers and local database recovery dumps may contain identifying JSON/data. A read-only schema/aggregate audit was performed against the configured Neon database; see evidence/retention-readonly.json. No production row content was printed or changed. Backup provider TTLs, retained local dumps, SMTP content, host logs and Redis persistence remain unverified. No source review can establish those provider settings.

## SDK and network scope

Both resolved dependency trees are saved in evidence/*-resolved-packages.json. Mobile resolved direct/native families: Expo57/RN0.86/React19; camera57.0.5, image-picker57.0.20, image57.0.5, audio57.0.5, file-system57.0.7, secure-store57.0.4, print57.0.2, sharing57.0.22, router57.0.23, web-browser57.0.3, clipboard57.0.2, device57.0.2, constants57.0.19, asset/font/linking/haptics/splash/system UI; AsyncStorage2.2.0, NetInfo12.0.1, React Query5.101.4, Axios1.19.0, Socket.IO client4.8.3, Reanimated4.5.1/Worklets0.10.1 and navigation/screens/gesture dependencies. Platform functionality does not by itself prove vendor data collection. No native billing, ad network, social OAuth or crash analytics package found in the declared mobile graph. Final native transitive dependencies/manifests/signatures still need archive/AAB inspection.

Backend resolved inventory includes Express4, Prisma6, PostgreSQL, ioredis, Socket.IO4, SMTP/nodemailer, multer1.x and image-processing/import packages. The Prisma duplicate dependency/version discrepancy and multer1.x maintenance/security review remain engineering findings; no blind mass upgrade was made.

Pre-login and consent-dependent network capture: **NOT TESTED**. Source shows session restore may contact /auth/me before the private interface appears; OTP/login/public deletion contact the backend when invoked. Local bundled assets do not establish zero network behaviour. Capture fresh-install DNS/HTTPS destinations and headers on both release binaries, without collecting real user content, including refusal, sign-out, restore and external link paths. No optional marketing consent or tracking toggle was invented.

## Apple App Privacy draft (not console-ready)

Use [Apple's definitions](https://developer.apple.com/app-store/app-privacy-details/) checked 12Oct2026. Do not import Play categories verbatim.

| Apple category | Proposed answer from source | Purpose/linkage | Unresolved evidence |
| --- | --- | --- | --- |
| Contact Info: name, email; phone/address where actual forms transmit them | Collected | App functionality, account management; linked to identity | Legacy/admin fields and postal-address mapping |
| Identifiers: user ID | Collected | Functionality/security; linked | Any device identifiers from native/network stack |
| User Content: emails/text messages, photos/videos, other user content | Collected for chat/uploads/records | Functionality, support/moderation; linked | Precise document/sensitive-data classification and optional-disclosure exceptions; conservatively include core content |
| Financial Info: other financial information | Likely collected for entered payout/shift/insurance data about individuals | Functionality; may be linked | Separate purely company totals from personal finance; do not claim payment-card collection |
| Sensitive Info / Other Data | Review incident/age-record fields and actual content | Optional recordkeeping may identify third parties | Data minimization/child data; cannot choose “none” without assessment |
| Usage Data / Diagnostics | Undetermined | Backend access/lastActive and error logs | Native traces, host logs, vendor contracts and redaction |
| Tracking | No source evidence found; provisional only | No ATT added solely for banner presence | Vendor/link behaviour and cross-company linkage must be checked |
| Purchases, location, contacts, health, browsing history | No dedicated feature/API found | Not selected on source evidence alone | External embedded browsing, SDK and user-content classification still reviewed in final forms |

## Google Play Data safety draft (not console-ready)

Use [Google definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) checked 12Oct2026. Do not select “no data collected.”

| Play data category / question | Draft | Evidence / unresolved choice |
| --- | --- | --- |
| Personal info: name, email, user IDs; phone/address where collected | Collected, identity linked | Required account details versus optional staff/business fields must be marked separately |
| Messages, photos and videos, files and docs, other user-generated content | Collected when used | Optional feature submissions; app functionality/support/abuse prevention |
| Financial info: other financial information | Assess as collected where records describe individuals | No purchase/card/credit data integration found; bookkeeping is still data |
| App activity, diagnostics, device or other IDs | Pending runtime/log assessment | Last-active/read receipts/actions and provider logging are not automatically ephemeral |
| Shared with third parties | Pending recipient-by-recipient determination | Processors may meet the service-provider exception; user-initiated sharing has distinct rules. Neither exception means no collection |
| Encryption in transit | Intended HTTPS/WSS production configuration | Verify all shipped destinations, images, email and provider transport before attesting |
| Deletion request link and deletion capability | Implemented locally, not live verified | /account-deletion resource, in-app workflow; provider/backup completion blocked |
| Independent security review / certification | Do not claim | None supplied |

Unanswered business/legal facts: full operator legal identity/address if required; hosting/provider locations and contracts; actual retention and shared-record basis; child-access/privacy assessment; catalogue/news/image rights; moderator and escalation responsibilities; support mailbox delivery; existing public privacy URL contents. Do not publish this working document as the app's privacy policy.

## 14 October 2026 — durable cache update

The Redis service now persists cache values in PostgreSQL `CacheEntry`, using hashed keys, revisions and per-key expiry. This includes OTP request records, rate-limit counters, presence/socket mappings and application cache payloads already handled by the service. Redis is a bounded mirror; PostgreSQL is authoritative for failover and revision validation. Expired entries are denied immediately and pruned by the running backend. Provider backups can retain historical cache values, so the approved backup/log retention targets remain subject to actual provider verification. This is an internal implementation inventory update, not a published retention promise. See `backend-services-fix.md` for tests and operational limits.
