# App Store Connect submission pack — DRAFT / BLOCKED

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

12 October 2026. Existing-listing status and prior rejection are unknown. Use the existing com.n1sh.paymi record if present. EAS project and remote numbering are preserved. Highest inspected historical iOS build is 1.1.0(29); do not use local buildNumber 3 as a new submission number. Verify both the latest uploaded build and live version in App Store Connect before assigning the release version.

## Metadata draft

Name: Paymi

Subtitle: Tools for your shop team

Primary category recommendation: Business. Secondary category, copyright holder/year and any trademark permission need owner confirmation. Operator is Kaliam; a legal entity suffix/address was not supplied. Language draft: English(UK). Price: Free. Public availability: United Kingdom only; use TestFlight for invited testers in India. Keep iPad support only if the actual iPad release matrix passes; currently supportsTablet=true and must be tested.

Description:

> Keep everyday shop work together in Paymi. Owners and authorized employees can work with shared shopping lists, stock records and team tasks in private shop workspaces.
>
> Record expiry dates, fridge temperatures, cleaning, incidents, waste, supplier payouts and shift totals. Keep shop certificates and use barcode lookup, product comparisons, label tools and system printing or sharing.
>
> Use team and direct conversations, and read the community rules before posting. Report messages or block a sender from the chat safety controls.
>
> An account and the appropriate shop permissions are required for private workspace access. Paymi is free in this release and offers no subscriptions or in-app purchases. Operated by Kaliam. Support: support@paymi.co.uk.

Use only after all named flows pass the installed-candidate tests; do not advertise guaranteed savings, regulatory compliance, money transfers or unsupported printer hardware.

Keywords draft: shop,retail,inventory,team,tasks,barcode,labels,expiry

Release notes draft (only for deployed/tested changes):

> Added personal account deletion requests and status tracking, chat reporting and blocking, and manual barcode entry when camera access is unavailable. Improved session security and production configuration. This release is free.

Support URL candidate: https://backend.h7tex.com/support — BLOCKED until deployed/live verified.
Privacy URL: BLOCKED; review/host public-drafts/privacy-policy.md first.
Marketing URL: paymi.co.uk requires live content verification; optional, not a substitute for support/privacy.

## Content rating worksheet

The target audience is 13+, not an 18+ product restriction. Apple's questionnaire calculates a rating; do not simply enter13+ because the owner chose that audience. [Official rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) checked 12 October 2026.

| Descriptor | Source-based draft | Action before submitting |
| --- | --- | --- |
| Messaging/chat; broadly shared UGC | Yes (direct/team/ALL Chat, text/images) | Confirm final controls and moderation |
| Parental controls / age assurance | None implemented | Do not claim owner/staff permissions are parental controls or verified age |
| Advertising | Banner/advertisement feature present; paid status unknown | Owner confirms actual paid promotions; inspect live ads |
| Social media | Assess ALL Chat against feed/discovery definition | Group chat alone should not be guessed into/out of a distinct category; save console explanation |
| Unrestricted web access | News uses system in-app browser, arbitrary remote source URLs | Test browser navigation and link constraints before answering |
| Alcohol/tobacco/drug references | Catalogue/age-record feature can contain them | Review actual content and frequency; no blanket “none” |
| Violence/mature themes | Incident text/photos and user uploads could contain them | Review supported/published content and moderation; no invented frequency |
| Medical treatment, gambling, simulated gambling, contests/loot boxes | No such product features found | Verify points are fixed reporting rewards, not chance-based activities |

Under current definitions, infrequent alcohol/tobacco references can produce13+, unrestricted web access16+, and frequent alcohol/tobacco references18+. These are conditional results, not assigned ratings for Paymi. If accurate content answers yield a rating above the intended audience, make an explicit content/access decision with the owner; do not understate the questionnaire. Earlier OS ratings can differ. Final rating: **BLOCKED pending content/browser review and console calculation**.

## Screenshots and icons

Existing source icon: paymi_v2/assets/images/icon.png. Do not replace branding or generate mock screenshots. Capture actual final candidate on required current iPhone/iPad sizes in the console: workspace/list, collect/scanner manual path, tasks/temperature tool, labels, team chat/report controls, profile/deletion. Use synthetic data and no personal credentials. Save platform/device/OS/version/build and capture timestamp alongside images under docs/release/screenshots/ios/. Currently **no final-candidate screenshots** exist.

## Reviewer access and notes — provisional, not submitted

Create dedicated owner and employee accounts with a synthetic shop, populated list/task/log/certificate and a second permitted shop for switch testing. Verify login from a fresh install with ordinary reusable email/password; reviewer must not depend on an expiring signup OTP or the owner's personal inbox. Create separate disposable deletion-test accounts so reviewer access survives a deletion test. Do not place credentials here: use secure App Review Information fields. Admin access is only needed if that role is actually part of the submitted mobile experience; isolate it from real customers. No universal password, reviewer detection or OTP bypass was added.

Suggested notes, after candidate validation:

> Paymi provides private shop workspaces. Identity determines which shop records and employee tools a person may access. Owners and staff use the same application with server-enforced permissions.
>
> Sign in with the supplied owner account. Open Profile → My Supermarkets to choose the supplied shop. Open Lists and the supplied list; use Profile's shop tools for tasks, temperature records and other sample business records. Sign out and use the employee account to review the granted tools.
>
> Profile → Delete personal account starts password-verified personal deletion; About Paymi and the deletion page are also available before sign-in. Use the separate disposable account for destructive testing. Shared shops and other staff accounts are preserved. A private receipt shows request progress.
>
> Chat → a conversation → Chat safety presents the rules. Use the flag beside an incoming message to report content or block its sender. Camera access is optional; the scanner offers manual barcode entry. Printing/sharing uses system tools. There are no subscriptions or in-app purchases in this release.

Replace the notes' deletion completion claim with the actual verified worker timing and ensure it is live before submission. Do not claim this draft proves approval.

## Provisional response to the unavailable rejection

> We have reviewed account access in Paymi. Its core features manage private shop workspaces, staff permissions and shared operational records, which require authenticated access. We can provide the exact review navigation and ordinary test accounts for these implemented features. Support, recovery and personal deletion are available without opening private shop data. We are also assessing the standalone calculators, catalogue browsing and label utilities against guideline5.1.1(v). Please refer to the attached feature-access explanation and verified candidate evidence.

This response is provisional: no exact rejection text or disputed candidate has been supplied. It does not assert the rejection is resolved.

## Console actions, only after gates pass

Verify membership/team, app registration/bundle ID, existing listing/version, agreements, UK availability, content rating, App Privacy answers, support/privacy links, export compliance and device families. Existing ITSAppUsesNonExemptEncryption=false is not a verified legal export determination; owner confirms applicability. EU trader declarations require reassessment if EU storefronts are added; UK alone is not EU distribution. Obtain/validate signed archive with the compatible Xcode/SDK, inspect manifests/reason APIs/signatures, upload to TestFlight, run device/upgrade/reviewer tests and review crash feedback. Upload, submit for review and release require separate owner authorization and separate observed status records. No upload command was executed here.
