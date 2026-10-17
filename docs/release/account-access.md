# Account access decision

12 October 2026. Owner instruction: retain accounts for private workspaces, explain standalone-tool changes before implementing. **Keep authentication for private workspaces. Owner subsequently authorized anonymous public promotions; `/promotions` and `/promotion/[id]` now use the constrained public feed, with private-list saving requiring login.** Prior Apple rejection remains unresolved until the actual text and submitted build are inspected.

| Feature | Public/private data | What identity enables or protects | Account necessary? | Intended access | Evidence |
| --- | --- | --- | --- | --- | --- |
| Workspace selection, stock, lists/collect, exports | Private shop records | Ownership, tenant boundary, cross-device collaboration | Yes for shared records | Authorized owner/staff only | ownership + selected-shop checks, multiSupermarkets tests |
| Employee permissions and tasks | Private staff/work | Grants, assignments, audit attribution | Yes | Owner or permitted staff | employee/task routes, authorization/features tests |
| Expiry, fridges, cleaning, incidents, waste, age records | Private operational/customer/staff data | Shop-scoped access and responsibility | Yes | Per-tool permissions | shopTools tests and middleware |
| Certificates, payouts, shift sheets | Private business documents/amounts | Protect shop records and staff roles | Yes | Authorized shop members | private uploads and scoped APIs |
| Personal/team chat | Private or member-visible content | Sender identity, membership, blocks/report handling | Yes | Participants/team, company administration | chatAccess and chatSafety tests |
| ALL Chat | Visible across registered user community | Persistent posting identity and abuse controls | Yes to post; reading dependency alone is weaker | Current members only, pending moderation/access decision | getUserChats, getChatAccess |
| Profile | Personal account data | Account management | Yes, but not justification for entire app | Signed in | Profile screen |
| Supplier catalogue, comparisons and promotions | Largely public/commercial data | Price report attribution; private lists after selection | Not necessary just to browse | Current authenticated navigation retained | compare, catalogue and banner code |
| News | Editorial/public links | None for reading | No in isolation | Current access retained | news route/UI |
| VAT and profit calculators | Local user input | None | No | Current access retained | /(app)/vat-calculator, profit-calculator |
| Local label composition/printing | Local drafts, optionally private shop products | Saved local ownership; private lookup integration | Not necessary for standalone custom labels | Current access retained | labels model/storage/output |
| About, privacy information, support, recovery, deletion initiation/status and rules | Public help plus user-verified account action | No shop access needed; passwords/receipts protect account actions | No general app session needed | Before sign-in | /about, /account-deletion, /chat-safety and website routes |

Apple 5.1.1(v) concerns the complete product's significant account-based functionality, not a requirement to justify every calculator independently. Google Play does not have that same blanket Apple rule. Private recordkeeping is real and server-enforced; profile/marketing/database cosmetics are not the rationale. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) checked 12 October 2026.

If the exact rejection establishes that the submitted experience chiefly exposes public utilities, proposed smallest change for approval: make /vat-calculator, /profit-calculator, read-only news/promotions/catalogue/compare and custom label composition reachable without sign-in; gate saving shared lists, shop product lookup/stock, tasks, posting/report attribution and all private records. This is a proposal only, not an implemented redesign. It would require explicit route/API scoping and tests, not just a guest button.

No invented business features were added to justify login. Reviewer explanation in the store packs names real paths and dependencies. Ownerless-workspace resolution is separate from personal deletion: preserve an existing co-owner; otherwise verify an authorized successor through Kaliam's operating process without automatically promoting an employee or delaying personal erasure indefinitely.
