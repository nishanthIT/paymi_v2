# Profile UI redesign

The Profile tab now uses a compact account card with initials, the existing account role, and the active supermarket from `AuthContext`. Shop tools are grouped by purpose, with larger daily-operation cards, compact record tiles, and a business-tools panel. Support, privacy, and logout have separate visual sections.

The design uses the existing warm cream, caramel gold, and charcoal palette. Buttons include subtle press animations, system reduced-motion support, explicit accessibility labels, and at least 44-point touch areas. Labels can wrap; the grid reduces its column count for enlarged system text. The content width is capped on larger screens, and horizontal safe-area insets are respected.

## Preserved functionality

| Group | Existing actions |
| --- | --- |
| Account header | My Supermarket |
| Daily operations | Manage Expiry, Tasks, Temperature Log, Cleaning |
| Records & compliance | Incident Logs, Age Restriction Records, Certificates, Waste Log |
| Business tools | Supplier Payouts, Labels, Shift Sheet, VAT Calculator, Profit Calculator |
| Shop & support | Shop Employees, Report a Wrong Price, About PayMi |
| Privacy & account | Privacy Policy, Delete Personal Account, Log Out |

All 20 actions retain their original route destinations, callbacks, and permissions. Privacy Policy still passes `privacy: '1'` to `/about`. Tool taps retain selection haptics. Logout retains its confirmation, cancellation, disabled pending state, storage-error handling, and final state reset.

The four badge queries, their enabled conditions and cache intervals, and all count calculations are unchanged. Counts remain hidden at zero and visually capped at `99+`; accessibility labels announce the full count. No APIs, authentication logic, database structures, or dependencies were changed.

There was no existing profile-edit screen, route, callback, or update API. The header remains informational; no nonfunctional edit control was introduced.

## Validation

- TypeScript (`tsc --noEmit`) and ESLint on the changed Profile files passed.
- All 146 existing automated tests passed.
- Independent AST comparisons against the original screen confirmed unchanged queries, badge calculations, tool configuration (apart from presentation grouping), navigation arguments, and logout logic.
- Isolated browser checks exercised all 19 navigation actions, including the privacy parameter, plus logout confirmation, pending state, and redirect. Backend requests were intercepted in the test context; no real account data was changed.
- Browser checks covered owner, full-access employee, restricted employee, and no-active-shop states; all four badges, including `99+`; long account/shop names; 320, 390, 430, and 768-pixel viewports; scrolling; touch target sizes; and horizontal overflow.
- The final layout refinement attaches record badges to their icons and lets incomplete grid rows fill the available width.
- Final browser checks revalidated 320/390/430/768-pixel layouts after those refinements, including badge separation with 130% text at 320 pixels. This enlarged-text browser check approximates text scaling; native system text scaling still needs device verification. No page errors occurred.

Saved evidence uses an isolated test account, never application placeholder data:

- [Profile header and daily tools](evidence/profile-ui-2026-10-30/profile-top.png)
- [Business tools and account actions](evidence/profile-ui-2026-10-30/profile-account.png)
- [Final layout check results](evidence/profile-ui-2026-10-30/layout-checks.json)

Browser validation does not replace native device testing. Android/iOS device rendering, VoiceOver/TalkBack, native haptics, and native confirmation presentation were not tested in this environment.

## Source scope

- `src/app/(app)/(tabs)/profile.tsx`: existing screen orchestration and redesigned layout.
- `src/features/profile/components/profile-sections.tsx`: presentation components and styles.
- `src/features/profile/types.ts`: Profile tool presentation types.

Other screens and existing unrelated working-tree changes were left untouched.
