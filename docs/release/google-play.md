# Google Play submission pack — DRAFT / BLOCKED

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

12 October 2026. Preserve package com.n1sh.paymi and existing Play App Signing/upload identity. Confirm whether a listing exists before creating anything. Local versionCode 2 is not a safe next production code; inspect console history and use EAS remote autoincrement with a verified increasing code.

## Metadata draft

App name: Paymi

Short description: Shared lists, stock records and daily tools for your shop team.

Full description:

> Paymi brings daily shop work into a shared workspace for owners and authorized employees.
>
> Work with shopping lists and stock records, scan or enter barcodes, compare product information, assign tasks and keep operational logs. Record expiry dates, fridge temperatures, cleaning, incidents, waste, supplier payouts and shift totals. Manage shop certificates and prepare labels for system printing or sharing.
>
> Use team and direct conversations with community rules, message reporting and blocking controls. Private shop information requires an account and the permissions granted by the shop owner.
>
> Paymi is free in this release. No subscriptions or billing are enabled. Operated by Kaliam. Contact support@paymi.co.uk for help and privacy requests.

Category recommendation: Business / application. Contact email supplied, not delivery-tested: support@paymi.co.uk. Website/support/privacy/deletion links must be live verified; candidate support/deletion routes are in public-drafts/hosting.md. Select UK production availability. Use test tracks/tester access for India; do not expand public launch territory just to enable tests. Check the actual console track/territory settings and account-region eligibility.

Release notes draft: “Added personal deletion requests, chat reporting and blocking, manual barcode entry and stronger session security. Paymi remains free.” Only use for the deployed, installed and verified candidate.

## App content forms

| Form | Draft / required evidence |
| --- | --- |
| App access | Restricted functionality: yes. Supply English instructions and secure reusable owner/employee credentials; see below. No geographic/IP/OTP/inbox dependency |
| Ads | Advertisement/banner feature exists; review live inventory and answer honestly. No third-party ad SDK was found, which does not prove no ads |
| Target audience | Owner intends 13+. Consider13–15,16–17,18+ age groups where actually designed/appropriate. Do not select under13 or adults-only contrary to confirmed scope; confirm country-specific child rules and safeguards |
| Content rating (IARC) | Business utility with communication/UGC, images and external news links. Report relevant alcohol/tobacco/incident content and interactive features truthfully. Final rating is generated, not invented from target age |
| Data safety | Separate draft in privacy-data.md. Personal info/content collected; processor sharing and actual diagnostics still unresolved |
| Account deletion | In-app and external request flow implemented locally; stable public deletion URL and complete processing proof required |
| Financial features / health declarations | Bookkeeping/VAT/profit records, not banking/loans/medical treatment. Answer actual current console questions; do not claim credentials or regulated offerings |
| Permissions | Camera for scan/photo; system picker/print/share. No restricted SMS/location/Accessibility/all-files features found. Inspect final manifest before asserting absence |
| Pricing / purchases | Free. No in-app products/subscriptions in this candidate |

Use [audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en) and [content ratings](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en), checked 12 October 2026. Families applicability depends on actual audience and jurisdiction;13+ is not an exemption from all child privacy/safety requirements. Do not translate Apple's numeric result into a Play/IARC rating.

## Reviewer instructions — English draft

1. Open Paymi and sign in with the dedicated owner credentials entered securely in Play Console's App access section. No registration or email OTP should be needed for these existing accounts.
2. Open Profile → My Supermarkets and choose the synthetic review shop. Open Lists → the supplied list and the available shop tools to exercise sample stock, task, temperature, cleaning and document workflows.
3. Sign out and use the supplied employee account to verify the assigned tools and shop permissions. Use only synthetic data.
4. Chat → conversation → Chat safety shows the rules. Long-press an incoming message → Report Message opens the reason/explanation form and block controls. No separate rules acceptance is required to post. The terms-before-UGC release requirement remains unresolved; see moderation-refinement.md.
5. In the scanner, refuse camera permission and use manual barcode entry. Printing uses the operating system's print/share flow; no proprietary printer is required for other features.
6. Use the separate disposable account for Profile → Delete personal account. Verify with its password and type DELETE. Save the returned private receipt for status. The external deletion URL works without reinstalling the app after deployment.
7. About Paymi provides support/privacy information and recovery before sign-in. This release has no payment/subscription checkout.

Credentials, exact synthetic resource names and live links are **BLOCKED pending provisioning and clean-install verification**. Store secrets only in secure review fields. Do not introduce hidden reviewer behaviour or a different product. Keep the backend/accounts available for the review period and replace any account deleted during review.

## Assets and eligibility

Use actual candidate screenshots for phone and supported tablet layouts (list, shop tools, labels, chat safety). Store under docs/release/screenshots/android with device/OS/versionCode/date. Existing icon sources are in paymi_v2/assets/images; validate final adaptive/store icon rendering and prepare a truthful feature graphic. No mock screenshots were generated and no final graphics package is certified.

Verify developer identity, agreements, app registration, account type/creation date, testing tracks and production access. For affected personal accounts created after 13 November 2023, the current minimum is 12 opted-in testers continuously for 14 days before a production-access application. Do not apply that rule blindly to all accounts; completing it does not grant production access. Source: [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), checked 12 October 2026. Check account/app registration status against the 30 September 2026 deadline page; automatic registration must be observed, not assumed.

Build the increasing-code signed AAB targeting API36, inspect permissions/ABIs/ELF alignment, validate16KB runtime, upload only with separate authorization, run internal/closed testing and inspect pre-launch crashes/ANRs/accessibility. Approval and production release are distinct from building/uploading. A local debug-signed bundle, JS export, or successful EAS build history is not a publishable candidate. No console upload/submission was executed.
