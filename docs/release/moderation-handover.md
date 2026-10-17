# Moderation handover — controls implemented; operation BLOCKED

> **13 October update:** [moderation-refinement.md](moderation-refinement.md) and [current validation](evidence/moderation-validation.json) supersede older acceptance, report-visibility, candidate/build and test statements below. Owner handles all builds and store actions. Earlier binaries are not candidates for the revised source.

13 October2026. Keep registered-user global/direct chat access as instructed. Do not launch an unstaffed public service or infer operation from the existence of controls. Kaliam is the operator; support@paymi.co.uk and07534 333494 are supplied contact details, not evidence of moderation staffing or response coverage.

## Implemented paths and limits

Mobile long-press→Report Message opens category/explanation submission and personal block/unblock. Rules are non-blocking; no Accept button. Categories: ABUSE, SEXUAL_CONTENT, CHILD_SAFETY, THREATS, SPAM, OTHER. The existing company admin application now has **Reported Chats** at /moderation, guarded by company Admin role in both UI and API. It polls every30seconds while open, displays urgent cases and loading failures, and supports remove/no-violation, suspension with duration/reason, extension and lift. Only company Admin can inspect reporter/subject identity, exact evidence and bounded surrounding context. Never disclose reporters or internal notes to respondents.

The backend snapshots only reported message content/author/type/time and attachment metadata. A local reported attachment is copied to private .private-moderation (or MODERATION_EVIDENCE_DIR), outside static uploads; directory0700/files0600. Admin-only authenticated download uses no-store and attachment disposition. Snapshot survives author deletion; missing/legacy/remote attachment evidence is marked unavailable, never claimed reviewed. Case evidence is personal data with unresolved retention/basis; include it in deletion review and actual policy. Do not automatically delete evidence without that decision.

Removal hides affected content and all messages reusing its upload URL, denies ordinary attachment retrieval and sends live invalidations. Suspensions use database expiry, cover all REST sessions and typing packets, and retain read/report/block access and private shop operations. Decisions have an audit trail. Maximum single active horizon is30days; moderators may choose shorter durations. This is a control limit, not a promised penalty policy. Authenticated report-based subject selection prevents arbitrary user IDs in the suspension request.

## Required operating fields (owner to complete)

- Named primary moderator and approved Admin account: **missing**.
- Backup moderator, actual coverage/timezone, report monitoring schedule and alert destination: **missing**.
- Urgent-safety escalation contact and lawful external reporting process: **missing**.
- Case-evidence retention, access reviews and deletion/appeal handling: **missing**.
- Effective objectionable-content filtering, youth-safety risk assessment and content operating policy: **not verified**. Reporting, blocking and manual removal alone do not prove this requirement.

Community rules prohibit harassment, threats, sexual/child exploitation material, hatred, illegal content, scams/spam, unauthorized personal information and arranging age-restricted sales to minors. For urgent threats or suspected child exploitation, restrict dissemination, preserve only necessary secured evidence, escalate through the approved operating process and applicable authority/provider channels; do not circulate harmful attachments. No invented external reporting contact or guaranteed response time is published.

## Deployment and demonstration

1. Apply20261012124000_moderation_evidence_suspension and20261013100000_moderation_refinement after the earlier release migrations; deploy matching backend and admin build. Preserve existing accounts and customer data.
2. Configure private evidence storage, access/backup/retention, and existing Admin access. Verify it is not served by the proxy/static server. No reviewer backdoor or special product experience.
3. Run `node scripts/releaseQueueHealth.js` under the host's approved monitoring scheduler. It emits aggregate counts only; exit2 means urgent/open-over24h reports, over7day deletion or stalled processing; exit1 is a service failure. These are engineering alert thresholds, not staffed response promises. Wire the result to the real operator and demonstrate alert delivery. No external messages have been sent by this work.
4. Execute device-tests.md test8 with synthetic accounts, including original-message deletion, confidential evidence access, live removal, block, multi-session suspension, extension/lift and restart expiry. Admin sign-in and visibility must be ordinary and reusable.
5. Record operator name, date, scenario, actual result, alert receipt, escalation/appeal exercise and evidence path. Until that happens, moderation remains **BLOCKED operationally**.
