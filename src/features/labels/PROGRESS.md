# Labels feature — implementation progress record

Working from `Fabelfy_Label_Printing_Prompt.md` + reference screenshots in
`~/Downloads/label_for_prompt` (24 files present; see "Reference inventory").

## Batch status

| Batch | Status | Notes |
| --- | --- | --- |
| 1 — Reference & interface foundation | ✅ Done | |
| 2 — Scan/search/pricing | ✅ Done | See "Batch 2" below. |
| 3 — Shelf labels (Standard/Promo) | ✅ Done | See "Batch 3" below. |
| 4 — Reduced stickers | ✅ Done | See "Batch 4" below. |
| 5 — Shelf/alcohol catalogue T01–T19 | ✅ Done | See "Batch 5" below. |
| 6 — A4 catalogue T20–T29 | ✅ Done | See "Batch 6" below. All 29 catalogue templates exist. |
| 7 — Mixed sheets M00–M07 | ✅ Done | See "Batch 7" below. |
| 8 — Runner/Recent/Saved/Community/menus | ✅ Done | See "Batch 8" below. |
| 9 — Export/printing/verification | ✅ Done | See "Batch 9" below. Direct label-printer driver: not available (no SDK/device). |

## Reference inventory (checked 2026-09-25)

24 JPEGs present. **R22 primary (`…11.01.23 PM.jpeg`, Labels landing) is MISSING
from the folder**, as are duplicate tails `(1)(1)`/`(2)(1)`/`(3)(1)` variants and
`11.01.20 PM (3).jpeg`, `11.01.21 PM(1).jpeg` — all documented duplicates, no
information lost except R22. The landing was built from spec §3 plus the top of
R04 (search sheet over the landing), which shows the header, the four tabs and
the first two-and-a-half cards.

Inspected in detail for Batch 1: R04 (landing top + sheet), R05/R12 (catalogue
rows, bottom nav, chips), R16 (reduced editor top), R18/R21 (shelf editors),
R23 (mixed M02 editor).

## Batch 1 — what was built

Files (all new, nothing outside Labels changed except two registrations):

- `src/features/labels/tokens.ts` — scoped design tokens (bg `#F5F5F5`, blue
  `#3A7DF0`, promo reds/yellows kept distinct, insets 15/12, radii 14/10).
- `src/features/labels/registry/sizes.ts` — physical-size registry (exact mm,
  incl. 203.2/152.4/101.6 inch families), standard 3×7 sheet definition
  (15.5 mm vertical margins, no gutters), `mmToPt`, `mmToDots`.
- `src/features/labels/registry/manifest.ts` — six tools (exact titles +
  descriptions + routes), T01–T29 with exact titles/subtitles/sections/order/
  slots/orientation, M00–M07 with exact titles/descriptions/cells.
- `src/features/labels/renderer-contract.ts` — shared renderer types:
  `ProductSnapshot` (source RRP separate), `Money` (integer minor units),
  `LabelPricing` (price/RRP/Was/offer all separate, `priceEdited` flag),
  `LabelStyleOptions`, mm-based `LabelComposition` nodes.
- `src/features/labels/components/labels-screen.tsx` — white header (left
  chevron, left-aligned title, right accessory), grey body scaffold.
- `labels-tabs.tsx` — New/Recent/Saved/Community, blue active + short thick underline.
- `tool-card.tsx` — white bordered card, pale-grey 104×84 thumb tile, chevron.
- `tool-thumbnails.tsx` — six fixture artworks (deterministic decorative
  barcode pattern, display-only).
- `tool-placeholder.tsx` — honest "Not available yet" destination body.

### Route map

| Route | Screen | Status |
| --- | --- | --- |
| `/(app)/labels` | Labels landing (tabs + six cards) | Batch 1 ✅ |
| `/(app)/labels/shelf?mode=standard\|promo` | Shelf labels editor | Stub → Batch 3 |
| `/(app)/labels/reduced` | Reduced sticker editor | Stub → Batch 4 |
| `/(app)/labels/templates` | Pick a template (T01–T29) | Batch 5–6 ✅ |
| `/(app)/labels/mixed` | Mixed sheet (M00–M07) | Batch 7 ✅ |
| `/(app)/labels/runner` | Shelf liner editor | Batch 8 ✅ |

Registered in `src/app/(app)/_layout.tsx`. Entry point: "Labels" tile
(pricetags icon) added to Shop Tools on the Profile tab.

## Observed vs inferred (Batch 1)

Observed (from screenshots): header composition, tab strip with blue underline,
card anatomy, thumbnail tile treatment, black Scan/Search pill styling, blue
action colour, bottom-nav distinction (landing/catalogue keep nav; editors do
not), all exact strings used.

Inferred/decided (documented assumptions):
1. **Bottom navigation**: the reference app shows Home/Suppliers/+Lists/Basket/
   More. This app's existing tabs are Home/Lists/Chat/Profile. Per working
   rules 1 & 9 we extend the existing stack: Labels lives in Shop Tools
   (Profile tab) and opens as a pushed route, like every other tool. The
   reference five-item bar was NOT cloned — the existing navigation is the
   integration target.
2. **R22 missing**: landing built from spec §3 + R04's visible top half.
3. **Ellipsis menu**: rendered, no menu yet (contents unseen; Batch 8).
4. **Non-New tabs**: honest empty states until Batch 8.
5. **Thumbnail barcodes**: deterministic decorative pattern, fixture-only;
   real encoded barcodes arrive with the shared renderer (Batch 9 checks).
6. **Placeholder destinations**: five stub screens with correct reference
   headers and an honest "Not available yet" body, so navigation is real and
   nothing pretends to work.
7. Exact fonts unknown — system sans-serif with matched weights/sizes.

## Checks run (Batch 1)

- `npx tsc --noEmit` clean; ESLint clean on all new files.
- Rendered on Expo **web** (`npx expo start --web --port 8082`) at a 390 × 844
  viewport behind real auth: header, 4 tabs (New active with blue underline),
  6 cards in the exact reference order with exact copy; screenshot captured.
- Card → route navigation verified in the browser: SEL · Standard opens
  `/labels/shelf?mode=standard` with the "Shelf labels" header.
- Seeded one local test login for verification (`labels-test@paymi.dev`,
  local dev DB only, same pattern as scripts/createTestUsers.js).
- No changes to non-Labels behaviour beyond the two registrations.

Not verified: rendering on iOS/Android devices (web only so far), pixel
comparison against R22 (image unavailable), physical printing (Batch 9).

## Batch 2 — scan, search, editable pricing, drafts

Pure model (no React; runnable under Node for checks):
- `model/money.ts` — text ↔ integer pence; rejects >2dp; catalogue Decimal → pence.
- `model/barcode.ts` — EAN-13/UPC-A/EAN-8 length + check digit; Code 128 only
  when the owner explicitly marks "my own code".
- `model/label-item.ts` — **all RRP rules live here**: lookup prefills Price
  from RRP only while `priceEdited` is false; owner Price edits lock it; owner
  RRP prefills only an untouched Price; RRP never fills Was; offer qty/total,
  Was, RRP and Price are separate fields; `validateItem` blocks blank/0/invalid.
- `model/draft.ts` — reducer; each scan is its own row, lookups apply **by
  row ID** (out-of-order safe), late results for removed rows are dropped.

Integration:
- `catalogue.ts` — adapter over existing `/products/barcode/:code` and
  `/products/search`. Only `rrp` is used as a price source (shop/supplier
  prices ignored). Cleans literal "null"/"N/A" pack sizes found in real data.
- `hooks/use-label-draft.ts` — AsyncStorage autosave (400 ms debounce, no
  write before hydrate), key `labels.draft.v1.<shopId>.<userId>.<toolId>`.
- Camera: existing `/(app)/scanner` gained `intent=label` → emits the raw
  string via `scan-bridge.ts` and returns (permission/cancel handled by the
  existing scanner screen). One detection = one row (existing frame lock).
- Handheld: `HandheldScanCapture` — hidden input, no soft keyboard, only
  focuses when no other field is focused, submits on Enter.
- UI: `ProductSearchSheet` (R04), `ProductEditorSheet`, `LabelField`,
  `ScanSearchButtons`, `ProductRow`/empty state. Shelf screen hosts them.
- `BottomSheet` gained optional `sheetStyle` (white Labels surface).

Decisions / assumptions (Batch 2):
1. **Catalogue RRP is GBP.** The Product table has no currency column and
   is the UK catalogue. If a currency field is added, `applyLookupResult`
   must only prefill when it is GBP.
2. **Backend alias matching**: `/products/barcode` falls back to caseBarcode
   and case-insensitive matches. The label always keeps the originally
   scanned string; the matched catalogue barcode is not substituted.
3. **Drafts are device-local** (AsyncStorage, per shop+user). No backend
   draft storage exists yet; Saved/Recent (Batch 8) will decide on a server table.
4. **Photos** are stored as local file URIs in the draft. Upload through the
   media system is deferred to export (Batch 9).
5. Search results rows and the product editor are **inferred screens**.
6. Interrupted lookups (app killed mid-request) restore as "Lookup failed
   — tap to retry", not a stuck spinner.

Checks run (Batch 2):
- `npx tsc --noEmit` and ESLint clean.
- `scripts/labels-batch2-check.mjs` — **15/15 pass**, real model code
  against the live local backend (run:
  `LABELS_EMAIL=… LABELS_PASSWORD=… node --import ./scripts/register-ts-hook.mjs scripts/labels-batch2-check.mjs`).
  Real barcodes used: 5010511482313 (RRP 1.15), 5060116211443 (no RRP),
  072417337253 (leading zero, UPC-A), 5000000000005 (unknown).
- Browser (Expo web, 390×844): handheld-scanner simulation added 4 rows in
  scan order incl. a second facing; RRP prefill £1.15; "Needs price" and
  "Not in catalogue" states; edited price £0.99 shown with catalogue RRP
  kept in helper; draft (rows, order, edited price) survived a full reload;
  search returned real catalogue rows with RRP / No RRP.

Not verified: camera scanning on a physical device (the web build has no
camera path exercised), photo picker on device.

## Batch 3 — Standard & Promo shelf labels

**Reference availability:** R19, R20, R21 are no longer in
`~/Downloads/label_for_prompt` (only R17 and R18 remain). Standard mode was
built from spec §5 text + the R18 structure it shares; R17/R18 were compared
directly.

Shared renderer (pure, Node-testable — the same composition feeds thumbnails,
the A4 preview and, in Batch 9, PDF/printer output):
- `render/barcode-encode.ts` — real EAN-13/UPC-A/EAN-8/Code 128 modules via
  the existing `jsbarcode` encoders, with GS1 quiet zones.
- `render/shelf-label.ts` — 70 × 38 mm Standard / Tobacco / Full yellow /
  Half yellow. Text wrap + fit with min font; names that can't fit raise a
  warning (never ellipsised). Missing price = preview-only "Needs price"
  marker, never £0.00. Fixtures use GS1 restricted-circulation code
  2000000000008 so they can't collide with a real product.
- `render/sheet-layout.ts` — copies → instances, 1-based Start at, row-major
  fill, overflow onto new sheets from cell 1, physical cell rects.
- `render/shelf-settings.ts` — per-draft settings + LabelItem → content
  (prices always via `parseMoneyText`).
- `renderer-contract.ts` gained `price` nodes, wrapped text lines, rotated
  barcodes, `previewOnly` flags and composition `warnings`.

UI (`components/`): `composition-view.tsx` (RN drawing of a composition),
`shelf-editor-parts.tsx` (SheetCard, DesignPicker, OptionsCard, WidthSlider,
SheetSettingsCard), `sheet-preview.tsx` (A4 page + grid guides),
`start-at-sheet.tsx` (Start at grid, sheet chooser). `labels/shelf.tsx`
assembles them in reference order: sheet card → Design → Products →
Options → Preview → Start at / width.

Decisions / assumptions (Batch 3):
1. **Width range** 60–100 % in 12 stops (R17 shows ~12 ticks; min unseen).
   The barcode keeps ≥ 0.25 mm modules by borrowing width from the price;
   below 71 % a warning is shown instead of shrinking bars.
2. **Promo stock option** ("Printing on yellow labels") is an inferred row:
   yellow becomes preview-only (simulated stock), never inked.
3. **Barcode down the side** uses a 16 mm column so bars are longer than the
   flat layout's ~11 mm (the check caught an initial 10 mm column that made
   them shorter).
4. **Sheet chooser** lists only the one configured stock (spec: "only from
   real configuration").
5. **Start at selector** is an inferred screen (3 × 7 numbered grid).
6. **Sample label** in the preview appears only with zero products, at the
   Start-at cell, with a caption; pagination never includes it.
7. **Date** is captured once per editor session in device local time (no shop
   timezone setting exists). Export will capture its own job date.
8. **Typography** calibrated down from spec starting sizes to R18's measured
   proportions; R18 appears to come from a ~430 pt-wide phone, so some copy
   wraps earlier on a 390 pt canvas.
9. Standard-only options (price side, barcode down the side) are hidden in
   Promo and ignored by Tobacco/Promo renderers.

Checks run (Batch 3):
- `npx tsc --noEmit`, ESLint (React Compiler rules) clean.
- `scripts/labels-batch3-check.mjs` — **20/20 pass**: A4 geometry (cell 21 =
  row 7 col 3, 15.5 mm margins), Start at 21 × 2 copies → 2 sheets, Start at
  1 × 22 → 21 + 1, zero products → no instances, every option changes the
  artwork, promo values separate, coloured stock never inked, missing price
  never inked, owner price prints, long names reported, **generated bars
  decode with an independent GS1 EAN/UPC decoder** (incl. rotated + leading-zero UPC-A).
- Batch 2 suite re-run: 15/15.
- Browser (Expo web, 390 px): R18 promo top (Half yellow selected, Products 0,
  empty state, options), R17 (sample in cell 21, "Starting at label 21 — 20
  already used", full-width slider) reproduced via the real Start at flow;
  Standard with 4 real products (£0.99 owner price, £1.15 RRP, Needs-price
  markers); Barcode down the side toggled and persisted across navigation.
- `scripts/labels-render-board.mjs` + headless Chromium: high-res board of all
  designs/options and the two-sheet Start-at-21 example.

Not verified: physical print alignment on real 70 × 38 mm stock, scanning
printed barcodes with a hardware scanner (Batch 9).

## Batch 4 — Reduced sticker editor

References used: R16 (upper), R14 (middle), R13 (lower), R15 (Label size modal) — all present.

Renderer / model (pure):
- `render/reduced-sticker.ts` — any physical size; designs **Reduced**,
  **Was / Now**, and **Price (provisional)**. Missing optional parts collapse.
  Empty state = title + £0.00 **placeholder marked previewOnly** (never inked;
  printing is blocked). Portrait/narrow stickers stack Was / NOW / price.
  Yellow/Red backgrounds keep a white backing under the barcode; barcode bars
  and digits are always black regardless of Text colour.
- `render/sticker-settings.ts` — presets with R15 wording, dots from
  `mmToDots(mm, dpi)` (203 dpi only as the default resolution), custom-size
  bounds 20–104 × 15–150 mm, item → content, print validation.
- `render/composition-svg.ts` — composition → mm-unit SVG (previewOnly
  nodes excluded). Shared by the PDF path and dev boards.
- `export/roll-label-html.ts` + `export/roll-label-pdf.ts` — roll PDF, one
  sticker per page, page = label size, 100 % scale, via existing
  `expo-print` / `expo-sharing`.
- `model/barcode.ts` gained `inferCustomCode` for the free-form Barcode field:
  7–14 digit strings stay retail (typos flagged); letters or ≤ 6 / ≥ 15
  digits count as the owner's own code (Code 128).

UI: `components/sticker-editor-parts.tsx` (SizeCard, LabelSizeSheet + Custom
size form, DesignCarousel, Background/Text colour chips, CheckRow,
StickerPreview, PrinterStatusCard, PrintButton, PrinterSetupSheet,
PrinterHelpSheet, CurrencySheet). `LabelField` gained `inlineWhenEmpty`
(Material behaviour seen in R13/R14). `labels/reduced.tsx` assembles R16 →
R14 → R13 order.

Decisions / assumptions (Batch 4):
1. **Third design is inferred.** The reference card is cropped ("PROD… £7…
   Pri…"). Implemented as "Price": product name, one large price, barcode.
   Title is provisional until a full reference exists. No further designs invented.
2. **One sticker at a time.** A scan/search/custom replaces the current
   sticker product (single-label flow; fields are inline, so no separate editor).
3. **Truthful printer state.** No direct label-printer driver exists, so the
   card always says "No label printer". Print label (enabled once valid) opens
   Set up, which says so plainly and offers the working **PDF sized to the
   roll**. The help sheet lists no printer models and explains black-only thermal output.
4. **Currency** is GBP only (the catalogue is UK); the dropdown opens a sheet
   confirming that rather than offering unsupported currencies.
5. **Custom size bounds** 20–104 mm wide (4 in print head) × 15–150 mm tall;
   dots shown at the default 203 dpi until a printer profile supplies its dpi.
6. **Artwork font** pinned to Arial/Helvetica metrics for preview and PDF so
   widths match (the app's web font caused an ellipsis in the first run).
7. The job date for Print the date is captured once at export time.
8. Thumbnail fixture barcode `5000168001357` matches the reference digits and
   is a valid EAN-13 check digit; fixtures are preview-only.

Checks run (Batch 4):
- `npx tsc --noEmit`, ESLint clean.
- `scripts/labels-batch4-check.mjs` — **19/19 pass**: R15 dot strings exact;
  300 dpi recalculation; custom bounds; defaults; empty state = only REDUCED
  + £0.00 and the placeholder is never inked; all three designs; optional
  collapse; None/White/Yellow/Red; red text keeps barcode black; date; every
  preset fits its physical size; RRP rules (prefill, owner edit wins, never
  Was); barcode typo rejected; copies validation; **real PDFs printed by
  headless Chromium from the app's exact HTML: 50 × 30 mm MediaBox
  141.732 × 85.039 pt with 2 pages for 2 copies, and 30 × 50 portrait**.
- Batch 2 (15/15) and Batch 3 (20/20) re-run.
- Browser (Expo web, 390 px): R16 top, R15 modal, R14/R13 fields and
  no-printer/disabled Print state reproduced; preset + custom size (150 mm
  rejected, 62 × 29 accepted with 496 × 232 dots); price entry enables
  Print → honest setup sheet; help sheet; handheld scan of 5010511482313
  prefilled £1.15 RRP with Was left blank; yellow + red text preview;
  sticker persisted across navigation.
- High-res artwork boards via headless Chromium (all designs, empty, colours,
  portrait, 40 × 30).

Not verified: printing on a physical sticker printer; the native share/print
sheet on iOS/Android (only the web print path and headless PDF were exercised).

## Batch 5 — Pick a template catalogue, T01–T19

References used: R12, R11, R10, R09, R08 (all present).

- `render/shelf-talkers.ts` — one renderer per template ID (19 distinct,
  parameterised). Physical size always from the registry (inch families keep
  203.2 / 152.4 / 101.6 × 76.2 mm). Discs are fully-rounded rects; the sample
  bottle is composed vector shapes (fixture only). Real photos → `image`
  node, contain-fit.
- `render/talker-settings.ts` — item + badge/list/small-print → content.
- `registry/catalogue-meta.ts` — icon + pastel tone per template, printed-field
  map, `APP_MARKET = 'GB'`.
- UI: `components/template-row.tsx`; `labels/templates.tsx` (catalogue);
  `labels/template/[id].tsx` (template editor, inferred screen: preview at
  physical aspect, one product via scan/search/custom + the Batch 2 editor,
  badge text, offer product list, small print, issues list).
- Renderer contract gained `underline` on text; SVG rects honour `radiusMm`;
  CompositionView now draws `image` nodes.
- Landing → Shelf talker → Pick a template → template editor.

Decisions / assumptions (Batch 5):
1. **Market**: no per-shop market setting exists, so GB is the fixed market.
   Every T01–T19 template is GB, so Show all shows the same list; the toggle
   and copy are real ("Showing all templates" / "GB only").
2. **A4 section** (T20–T29) was withheld until Batch 6 (now added).
3. **T10 discrepancy**: the R10 thumbnail shows "Sample product / Brand / NOW"
   with no price visible (appears clipped in the source); the catalogue text
   says "Big strikethrough was → now". Implemented with the prominent price,
   consistent with T14/T18.
4. **T16 Circle Badge has no price** — R08 shows only "OFFER" in the circle and
   "ON SAMPLE PRODUCT". Kept faithful; the badge word is editable.
5. **T17**: thumbnail (price in circle, name right) followed over its subtitle wording, per spec.
6. **Footer small print**: fixture thumbnails keep an illegible grey line in
   its place; production prints only owner-entered text (never invented terms).
7. **Photo designs without a photo** collapse the photo area (no sample image
   substituted); the editor tells the owner they can add one.
8. **No barcode** on T01–T19 (none in the references).
9. **Output** (PDF/print) for talkers arrives with Batch 9; no fake print button is shown.
10. Template editor is one product per card; a new scan/search replaces it
    (Batch 6 generalised this to one product per slot).

Checks run (Batch 5):
- `npx tsc --noEmit`, ESLint clean.
- `scripts/labels-batch5-check.mjs` — **17/17 pass**: exact order/sections/
  titles/subtitles for all 19 (transcribed reference table), exact physical
  sizes (8 in = 576 pt), GB family distinct from 8 × 3, icons, fixture
  text (OFFER £1.99, ON SAMPLE PRODUCT, each), Black Label underline + red
  price, **real edited product on all 19 prints owner £0.99 never RRP £1.15**,
  no-photo collapse, real photo contain-fit, missing price never inked,
  2 FOR £16 / each / Was separate, badge override, small print only when
  provided, long names reported without ellipsis, nodes inside the label.
- Batches 2–4 re-run (15/15, 20/20, 19/19).
- High-res board of all 19 fixture thumbnails compared against R08–R12
  (yellow insets and T18 "NOW" corrected after comparison).
- Browser (Expo web, 390 px): catalogue top (R12) and 8 × 3 → 6 × 3
  transition (R10/R09); 19 rows; one real scanned product per family (T01,
  T04, T08, T12, T17) with owner price £0.99, persisted across navigation;
  long-name warning on Black Label cleared after shortening via the editor.

Not verified: printed output of any talker (Batch 9).

## Batch 6 — A4 catalogue T20–T29

References used: R08 (A4 heading + Hero Poster/Triptych/Simple Trio), R07,
R06, R05 (lower scroll through Price Hero) — all present.

- `render/a4-posters.ts` — one renderer per ID for T20–T29 on the registry
  A4 sizes (portrait 210 × 297, landscape 297 × 210). Duo/trio designs take
  **one content per product slot**; an empty slot draws a preview-only
  "Add product N" (never inked, no sample art). T27/T28 draw the **same
  product's photo twice** (left + right). T27 prints italic "ONLY" before the
  price only when a price exists.
  Structure per reference: T20 red WOW banner + orange uppercase heading +
  hero left / price right; T21 dark-blue page with three panels, red price
  circles left, image tiles right; T22 thin red banner, three columns in the
  upper third, white lower area; T23 two stacked blocks (image left,
  uppercase name + price right); T24 large image left, small red badge,
  title, large price; T25 purple banner, two columns, red prices; T26 red
  banner, three columns, round red price badges; T28 huge red uppercase
  title, italic brand, twin photos around a black price; T29 huge black price
  top, small caption, centred photo, tiny red badge top-right.
- `render/templates.ts` — single entry for all 29: `hasTemplateRenderer`,
  `slotCount`, `renderTemplate(id, contents[], shared)`, fixtures.
  Multi-product fixtures are Sample product 1/2/3 at £1.99/£2.99/£3.99 as
  bottle/container/pack art (shelf-talkers gained `fixtureKind`).
- `catalogue-meta.ts` — icons/tones for T20–T29 (megaphone, lavender stack,
  teal/purple columns, beige split, red landscape outline, trophy, "T",
  dark tag) and field specs (badge text defaults to WOW where a
  banner/badge/ribbon is printed; T21/T23 have none).
- `template-row.tsx` — thumbnails via `renderTemplateFixture`; A4 rows show
  chips: **Portrait** (pale blue, phone icon) / **Landscape** (pale orange),
  plus **N products** (pale teal, grid icon) only on T21/T22/T23/T25/T26.
- `labels/templates.tsx` — lists every template with a renderer (all 29);
  the A4 section follows 4 × 3 in.
- `labels/template/[id].tsx` — now slot-based: `settings.slots` holds one
  item ID per slot. Each slot has its own product row, Scan and Search. The
  target slot is recorded when Scan/Search/Custom is opened, so a camera
  scan, search pick or custom product lands in that slot even if the lookup
  resolves late (lookups still apply by item ID). A handheld scan with no
  target fills the first empty slot; when all are full it shows a notice
  instead of overwriting. Issues list names empty slots and per-slot errors.
  Single-product drafts from Batch 5 migrate by item order.

Decisions / assumptions (Batch 6):
1. **Badge text and small print are shared** across the poster (one banner,
   one footer); names, prices and photos are per slot.
2. **Twin-photo designs have one product slot**; a second product is never
   accepted or drawn (`twinPhotoSharedProduct`), and the editor says so.
3. **"ONLY" on T27** is drawn italic, about a third of the price height,
   left of the price, because R05's thumbnail is too small to show its exact size.
4. **Minimum poster name size 4 mm (~11 pt)**: names that don't fit at this
   size raise the "too long" warning rather than printing unreadably small.
5. **Sample caption** (T24) is the pack-size line; real products print their
   pack size there or nothing.
6. Poster **output** (PDF/print) arrives with Batch 9; no print button yet.
7. Product photos from the local backend (`/uploads/images/…`) were blocked
   (404/ORB) in the web session, so the photo layout was verified with test
   URIs and fixtures, not live catalogue photos.

Checks run (Batch 6):
- `npx tsc --noEmit`, ESLint clean.
- `scripts/labels-batch6-check.mjs` — **17/17 pass**: all 29 templates
  T01–T29 in order with renderer + icon + fields; exact T20–T29 titles/
  subtitles/section/orientation/slots; A4 sizes (595.28 × 841.89 pt); chip
  set per template; icons; fixture text/prices, no warnings; structure
  (banner colours, dark-blue Triptych, 3 red circles, round badges, T29
  top-right badge); **duo/trio print each slot's owner price, never RRP,
  photos in slot order**; changing product 2 leaves 1 and 3 unchanged; empty
  slots preview-only; twin photos = same URI, second product ignored; ONLY
  italic only when priced; missing price never inked (other slots stay
  priced); no sample art for photo-less products; shared badge/small print;
  long names warned, no ellipsis; nodes inside the page and headings never
  overlap photos (this caught a T28 overlap with two-line titles, now fixed).
- Batches 2–5 re-run (15/15, 20/20, 19/19, 17/17).
- High-res board of T20–T29 (fixture + real products + empty slots) compared
  against R05–R08.
- Browser (Expo web, 390 px): A4 section after 4 × 3 in with all ten rows
  and correct chips; Simple Trio editor with three slots, product 2 filled via
  Search (£2.15), product 1 via handheld scan into the first empty slot
  (£2.59), product 2 edited to £1.79 with product 1 unchanged, product 3
  preview-only "Add product 3" plus an issue.

Not verified: printed A4 output (Batch 9); camera scan into a specific slot
on a physical device (the targeting logic was exercised through search and
handheld paths on web).

## Batch 7 — Mixed sheets (chooser, M01–M07, Custom)

References used: R03 + R02 (one chooser screen), R23 (M02 editor), R01 (M05
editor) — all present.

- `registry/mixed-geometry.ts` — explicit mm cell rects for M01–M07 on A4
  portrait, each cell exactly its registry size; `SIZE_LABEL` slot subtitles;
  `CUSTOM_SIZES`; `CUSTOM_SPACING`; `MIXED_SHEETS` (A4 portrait only).
- `model/mixed.ts` — pure state: entries (size, design, item, card text,
  copies) + fixed cells → entry IDs. `compatibleTemplates` matches exact
  physical size (Show all only lifts the market filter); `changeLayout`
  re-places entries by size and queues the rest (never erases);
  `placeInCell` refuses other sizes; persisted designs that don't match their
  slot size are dropped on read.
- `render/mixed-sheet.ts` — `renderEntry` throws rather than scale a
  wrong-size design; `buildMixedJob` is the single source for preview and
  PDF (fixed: artwork translated into cells, empty cells keep preview-only
  guides + numbers; Custom: `packCustom`); `entryIssues` blocks export of
  incomplete populated labels (price required only where the design prints
  one).
- `packCustom` — deterministic, order-preserving rows, centred, new page when
  the next row doesn't fit; never scales/rotates; oversize labels are
  reported as `unfit` and surfaced as an issue.
- `export/sheet-html.ts` + `export/sheet-pdf.ts` — one A4 page per sheet via
  expo-print/sharing (same route as the roll PDF).
- UI: `components/mixed-parts.tsx` (schematics drawn from the real geometry,
  layout rows, Custom lavender card, Print sheet selector, summary card with
  Change, slot rows, Refresh preview, Generate PDF, preview, size picker);
  `components/mixed-slot-editor.tsx` (inferred: compatible designs, product
  via scan/search/custom, card text, copies in Custom, Copy to slot N /
  Duplicate, two-tap Clear, Done); `labels/mixed.tsx` (chooser → editor →
  slot editor in one screen/draft). `TemplateRow` gained `selected`;
  `LabelsScreen` gained `onBack`; `ProductRow` copies are optional;
  `ChangeSheetSheet` takes a title/body.

Decisions / assumptions (Batch 7):
1. **Coordinates are calibrated, not measured**: shelf rows start 16 mm down
   with 8 mm gaps; square rows 24 mm down with 8 mm gaps; M07's shelf label
   sits 22 mm below the squares (wider gap visible in R02); two 4 in columns
   use 2.4 mm margins + 2 mm gap (203.2 + 6.8 = 210). Printers with
   non-printable edges may clip M03/M05 compact columns (Batch 9 print flow).
2. **Custom spacing**: 2.4 mm side margins, 10 mm top/bottom, 2 mm column
   gap, 6 mm row gap. Labels print in the owner's order; no rotation (the
   talker designs are orientation-specific).
3. **Custom sizes** are the template sizes that fit A4 portrait (8 × 3, 6 × 3,
   4 × 3, 7 × 7 cm, 203 × 75 mm). A4 posters aren't offered; the packer still
   reports any oversize label instead of shrinking it.
4. **Print sheet**: only A4 portrait is configured, so the selector lists it alone.
5. **One draft, three views** (chooser, editor, slot editor) in one route so
   no screen can overwrite another's state. The chooser always opens first
   (as from the landing card); picking the current layout restores the work.
6. **Preview appears on Refresh preview** (R23/R01 show none before) and says
   when it's out of date. Generate PDF also refreshes it to the exported sheet.
7. **Queue for other layouts**: entries that don't fit the new cells show
   under "Not on this layout" with Place in slot N / two-tap Remove; they
   aren't printed until placed.
8. A slot left with nothing entered (no product, no text) returns to
   "Tap to fill"; a chosen design alone isn't kept.
9. Copies to another slot get their own product copy so edits stay independent.

Checks run (Batch 7):
- `npx tsc --noEmit`, ESLint clean.
- `scripts/labels-batch7-check.mjs` — **18/18 pass**: chooser order/titles/
  descriptions/counts + intro text; every cell exact size, inside A4, no
  overlaps; topology (centred, stacked, 2 × 3, wide→medium→compact, hero +
  2 × 2, squares + shelf; 6.8 mm rule); M02/M05 slot subtitles; exact-size
  compatibility (Show all adds nothing, no A4 posters, 203 × 75 ≠ 8 × 3);
  poster can't be placed/rendered in a 6 × 3 slot; empty sheets ink nothing;
  filled slots at their cell position with unscaled artwork and the empty slot
  blank; owner price never RRP; validation (missing price blocks, valid subset
  OK, Circle Badge OK, no product / no design / long name block); layout
  changes keep and restore work; duplicate targets; Custom packing (exact
  sizes, margins, no overlaps, order, overflow pages); oversize label
  identified; copies; export has no guides; **real PDFs: 1 A4 page
  595.28 × 841.89 pt; Custom 7 × 8 × 3 → 3 A4 pages**.
- Batches 2–6 re-run (15/15, 20/20, 19/19, 17/17, 17/17).
- Board of M02/M05/M07/Custom sheets (real products) via headless Chromium.
- App (Expo web, 390 × 844 @2x, headless Chromium over CDP): chooser top and
  lower scroll vs R03/R02; M02 vs R23; M05 vs R01; empty Generate PDF →
  "Fill at least one slot"; incomplete slot → "Slot 1: Add a product"; slot 1
  filled by Search (£2.15, WOW) and slot 3 by handheld scan (£2.59, Was /
  Now); Refresh preview with slot 2 blank in place; M05 → both queued;
  M04 → one placed; Custom → both kept, reorder reflected in the preview.
  Fixed a nested-button warning on Custom rows found here.

Not verified: printed output on paper and the native share/print sheet on a
device (web print dialog can't be driven headless; PDFs checked from the
exact HTML); camera scan into a slot on a physical device.

## Batch 8 — Shelf runner, Recent, Saved, Community, menus, printer help

All inferred screens (spec §11): none of these appear in the references.
The supplied screens were not changed apart from ellipsis menus now opening.

- `render/shelf-runner.ts` — message-only strip: headline + optional
  supporting text (uppercase), Red/Yellow/Black/White stock, optional repeat,
  explicit sizes (presets 287 × 39 / 287 × 30 mm; custom 100–287 × 20–60 mm),
  warnings instead of ellipsis. `composeRunnerPages` stacks true-size strips on
  A4 landscape (4 × 39 mm or 6 × 30 mm per page) and overflows copies onto
  new pages; cut outlines are preview-only.
- `labels/runner.tsx` — preview at physical aspect, message, colour chips,
  repeat, strip size, copies with per-page count, Generate PDF (sheet PDF).
- `model/library.ts` — pure: storage keys per shop + user (the Batch 2 draft
  key is unchanged and shared), Saved add/rename/duplicate/delete as deep
  snapshots, print jobs (exact exported pages + source draft, newest first,
  capped at 25), `toolInfo` routes for every tool and all 29 templates,
  `formatWhen`, `sameDraftContent`.
- `render/draft-preview.ts` — `isDraftEmpty`, `draftSummary`, `draftPreview`
  for every tool, using the editors' own renderers.
- `hooks/use-label-library.ts` — AsyncStorage; every write re-reads storage
  first; lists live drafts by the shop+user key prefix; refreshes on focus.
- `hooks/use-label-draft.ts` — `clearDraft`; flushes the pending autosave on
  unmount (previously an edit within 400 ms of leaving could be lost).
- `components/labels-menu.tsx` — `MenuSheet` (destructive items need a second
  tap), `NameSheet`, `EditorMenu` (Save draft…, editor extras, Clear draft).
- `components/library-tabs.tsx` — Recent (In progress drafts + PDFs made:
  Print this PDF again from the snapshot, Edit a copy, Remove), Saved (Open,
  Rename, Duplicate, Delete), Community empty state; reopening a snapshot over
  different work asks first (Save that draft first / Replace it).
- `components/printer-info.tsx` — detected capabilities (true-size PDF,
  system print route per platform, share availability, direct printer: not
  available) + `PrinterInfoSheet`; the Batch 4 setup/help sheets now show the
  same list.
- Landing: Recent/Saved/Community tabs are real; ellipsis → Printing & PDF
  help, Saved labels, Clear PDF history. Shelf labels, Reduced sticker and
  template editors: ellipsis → EditorMenu (Reduced adds printer help). Reduced,
  Mixed and Runner record a PDF job after a successful (not cancelled) export.
  `ToolPlaceholder` lost its inert ellipsis.

Decisions / assumptions (Batch 8):
1. **Storage is device-local** (AsyncStorage, per shop + user). The backend has
   no label draft/job/template tables, so nothing syncs between devices yet and
   nothing leaves the device. Adding server storage is a backend task.
2. **Community**: no community-template service exists (the app's
   "community" is a chat group), so the tab is an honest empty state; nothing is
   fabricated or published.
3. **Menu contents** are inferred: Save draft / Clear draft (+ printer help
   where relevant) in editors; the Mixed sheet header stays as in R01/R23 (no
   ellipsis) — its drafts are saved from Recent › ••• › Save a copy.
4. **Runner sizes**: A4-landscape length less 5 mm each end so printers with
   non-printable edges don't clip; 39/30 mm heights; longer shelves use joined
   strips. No default message is printed ("SALE / UP TO 50% OFF" are only
   placeholders), so nothing is claimed that the owner didn't type.
5. **Job status** records only what is known: "PDF made" (native share) or
   "Print dialog opened" (web/system); it never claims a page printed.
   Reprint re-exports the stored pages, not a re-render.
6. Shelf labels and shelf-talker/poster output is Batch 9, so they don't record
   jobs yet; their drafts appear in Recent and can be saved.

Checks run (Batch 8):
- `npx tsc --noEmit`, ESLint clean.
- `scripts/labels-batch8-check.mjs` — **17/17 pass**: six tools + four tabs;
  no inert ellipsis; runner without product (preview-only prompt, nothing
  inked), red SALE strip styling/bounds, repeat/colours/presets/custom size,
  long text reported, A4 landscape strip sheets + overflow; keys per shop +
  user; Saved deep snapshots / rename / independent duplicate / delete; job
  pages immutable and capped; routes for all tools + 29 templates; timestamps;
  summaries + previews for every tool at physical size; saved draft reopens
  with owner price, catalogue RRP, start cell and width; Community has no
  fabricated/published content; printer info capability-based, no models;
  **runner PDF = 2 A4 landscape pages 841.89 × 595.28 pt**.
- Batches 2–7 re-run (15/15, 20/20, 19/19, 17/17, 17/17, 18/18).
- Board of runner strips (all colours, repeat/single, empty prompt, A4 sheet).
- App (Expo web, 390 × 844 @2x, headless Chromium over CDP): landing
  unchanged; Recent (drafts, then a recorded PDF job); Saved empty → saved via
  runner ••• › Save draft… with a typed name → Duplicate → reopen; guard when
  reopening over different work (earlier edit kept in Saved); Community empty
  state; Printing & PDF help with detected capabilities. Fixed a clipped
  runner supporting line found here (heavy-glyph width).

Not verified: native share sheet / AirPrint / Android print service on a
device; persistence across a real app relaunch on a phone (web reloads were
exercised).

## Batch 9 — Output, print routes, physical verification

Failures found and fixed:
1. **Web printing printed the app screen.** `expo-print` on web ignores the
   HTML and calls `window.print()`, so Reduced / Mixed / Runner "PDF" on web
   printed the UI. New `export/output.ts` prints the label document from a
   hidden iframe (its own `@page` size); native makes a true-size PDF
   (`printToFileAsync`) then opens the print dialog or the share sheet.
   Local `file://` photos are embedded for native PDFs. The old
   `roll-label-pdf.ts` / `sheet-pdf.ts` (this feature's own, now unused) were removed.
2. **Shelf labels and templates had no output.** Shelf: "Print N labels" at
   the end of the editor (below the R17/R21 captured area) → true-size A4
   sheets from the same compositions, one job date captured per print (the
   preview follows it), then an explicit "Next time start at label N" offer
   (never advanced automatically). Talkers pack true-size on A4; A4 posters
   print one page per copy.
3. **30 × 50 mm stickers refused every retail barcode** (EAN-13 needs
   28.25 mm at 0.25 mm modules). The barcode's blank quiet zones may now use
   the side padding (bars never squeezed, white backing clamped to the label).
4. **Catalogue rows truncated titles and stacked chips** vs R05–R08: 80 pt
   tiles for 4 × 3 / 7 × 7 / A4, compact chips, 15 pt titles; at 390 pt no
   title clips (measured in the DOM).
5. Price checks unified (`render/print-checks.ts`): barcode validated only
   where printed; price required only where the design prints one (Circle
   Badge); used by shelf, templates and mixed.

Output states (`OutputStatus`) report only what the platform knows: iOS
"Sent to the printer" (completion) or "Printing cancelled" (iOS rejects
with "Printing did not complete"); Android/web "Print dialog opened"; native
share "PDF ready". Cancelled jobs aren't recorded. Repeated taps are ignored
while a job runs. Recent records the reported status.

Checks run (Batch 9):
- `scripts/labels-batch9-check.mjs` — **17/17**: real PDFs from the exact HTML
  each route prints (headless Chromium), MediaBoxes measured, pages
  rasterised at 600 dpi (mutool) and decoded by **zxing-cpp**, an independent
  decoder: Start 21 × 2 → 2 A4 pages with barcodes physically inside cell 21
  then cell 1; Start 1 × 22 → 21 + 1 with every label in its own cell;
  EAN-13 / UPC-A / EAN-8 / Code 128 and the rotated barcode decode; module
  ≥ 0.24 mm measured; promo £11.25 / £8.75 / 2 FOR £16 in the PDF text; job
  date printed; reduced 50 × 30 / 50 × 25 / 40 × 30 / 30 × 50 roll pages
  (141.73 × 85.04 pt etc.) decode; talkers T01/T04/T09/T13/T17 true-size on
  A4; posters portrait 595 × 842 and landscape 842 × 595; Mixed M05; runner
  strip measured 287 mm in the raster; no preview-only marker or sample
  product in any PDF; RRP £8.75 → owner £8.49 survives a lookup refresh and
  is what prints. Needs ZX_PYTHON (a venv with zxing-cpp + Pillow).
- Batches 2–8 re-run: 15/15, 20/20, 19/19, 17/17, 17/17, 18/18, 17/17.
- **In-app scan → print (Expo web, headless Chromium over CDP):** handheld
  scan of I HEART PROSECCO 5060215330779 → RRP £11.49 prefilled → price
  edited to £8.49 → full reload (persisted) → Print → the HTML handed to the
  print iframe was captured and printed to PDF: A4 594.96 × 841.92 pt, text
  £8.49 (no RRP), EAN-13 decoded at 5.5 / 38.4 mm (inside cell 1); Next-start
  offer shown. Reduced sticker: scan → Print label → 50 × 30 mm PDF
  (142.08 × 84.96 pt), barcode decoded. Recent showed both jobs. (The
  catalogue has no product with RRP exactly £8.75; that exact case is covered
  in the model/PDF suite.)
- **Screenshot comparison** at 390 × 844 @2x, side by side with every
  reference file now present (R01–R18): R01–R03, R09–R18 match in layout and
  copy; R05–R08 matched after fix 4; R04 sheet content matches (the reference
  shows the iOS keyboard, system UI). R23 was compared in Batch 7; its file
  and R19–R22 aren't in the folder now, so they weren't re-compared.
  Known intentional difference: the reference's Home/Suppliers/+/Basket/More
  bar isn't cloned (Batch 1 decision: Labels lives in the app's own nav).

Remaining dependencies (not claimed):
- **Direct label printer**: no supported printer SDK/device is integrated, so
  Bluetooth/USB/network label printing is unavailable (reported in the app).
- **Physical tests**: nothing was printed on paper/labels and no hardware
  scanner read a printout; the native share sheet, AirPrint, Android print
  service and the iOS completion/cancel states were not run on a device.
- Shop timezone: none configured, so job dates use device local time.
- `src/components/ui/bottom-sheet.tsx` has a pre-existing lint error
  (`setState` in effect) outside the Labels feature; left unchanged.
