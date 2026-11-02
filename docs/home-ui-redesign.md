# Home UI redesign

Home now opens with a compact greeting and a full-width shop selector. The three existing shortcuts form a mixed card layout: Compare Products is the primary action, with Promotions and Report Price alongside it. Existing advertisements sit in a separate spotlight section, with real advertisement titles, an image-viewer cue, and pagination indicators. Daily News uses a horizontal collection of image-led cards, showing the same six articles in their original order.

The presentation follows the Profile redesign's cream, caramel gold, white, and charcoal palette. Press feedback and entrance animations respect reduced-motion settings. Layouts wrap long account/shop names, use larger touch areas, respect horizontal safe-area insets, and cap the content width on tablets. Quick actions stack with larger system text. The advertisement carousel measures its own available width so paging stays aligned inside the capped content area.

## Functionality preserved

| Existing feature | Preserved behavior |
| --- | --- |
| Greeting and current shop | Original name derivation and shop fallback; selector opens `/(app)/supermarkets` |
| Shop recovery | Same missing-shop/error condition, actual error or guidance, and supermarket route |
| Compare Products | Opens `/(app)/compare-products` |
| Promotions | Opens `/promotions` |
| Report Price | Opens `/(app)/report-price` |
| Advertisement images | Original images, 1.91 aspect ratio, caching, recycling keys, and image transitions |
| Carousel | 2,800ms automatic advance, three data copies, horizontal paging, drag pause, momentum handling, and recentering |
| Advertisement tap | Opens the existing fullscreen ImageViewer with the original image URL; does not follow `linkUrl` |
| News | First six items from the existing 20-item query, same ordering, whitespace normalization, date formatting, and image fallback |
| Article tap | Opens `/(app)/news/[id]` with the original ID |
| Pull-to-refresh | Concurrently refetches advertisements, news, promotions, and supermarkets; retains paused/offline and blur behavior |
| Loading and empty states | Existing conditions retained; skeletons restyled; empty advertisements hidden; original empty-news text retained |

The Home screen has no notification button or profile shortcut. Global notifications and the bottom tabs remain with their existing shared components. The promotions query remains in place even though Home displays only its original shortcut.

No backend API, database, authentication, permission, calculation, or dependency changes were made. The shared ImageViewer, Skeleton, refresh hooks, query hooks, API files, article screen, and Profile redesign were left untouched. The pre-existing `FlatListInstance` update in the carousel was preserved.

## Validation

- TypeScript and focused ESLint passed after the final UI changes.
- All 146 existing automated tests passed.
- Independent source/AST review confirmed unchanged Home state/data/refresh expressions, route arguments, date formatting, and carousel loop callbacks and effects.
- Android and iOS JavaScript exports both completed successfully. These were local validation exports with bytecode disabled, not release builds.
- Browser validation uses isolated synthetic API responses and images, with backend requests intercepted. Fixtures exist only in the evidence harness; the application continues to use its existing live data sources.
- Twenty browser checks completed: all shortcuts and six article routes, supermarket access/recovery, image-viewer open/close, banner auto/manual paging, horizontal news scrolling, all four refresh requests, six-item preview limit, dates, loading/empty/failure states, employee content, long names, and 320/390/430/768-pixel layouts and touch targets.
- A Metro development-server SSR cache error interrupted the combined browser run after the 13 core checks passed. The remaining seven state checks passed in a fresh server session; the saved report combines those completed checks and records the tooling interruption.

See [browser results](evidence/home-ui-2026-11-02/result.json), [Home preview](evidence/home-ui-2026-11-02/home-390-top.png), and [news preview](evidence/home-ui-2026-11-02/home-390-news.png).

Native device testing remains outstanding: no Android device/emulator was attached, and iOS device rendering was not available. Browser checks and native JavaScript exports do not establish native gesture behavior, platform rendering, or VoiceOver/TalkBack behavior.

## Source scope

- `src/app/(app)/(tabs)/index.tsx`: Home layout and existing orchestration.
- `src/features/home/components/home-dashboard.tsx`: header, shortcuts, news rail, loading/empty presentation.
- `src/features/home/components/home-action.tsx`: accessible animated press feedback.
- `src/features/home/components/ad-carousel.tsx`: banner presentation and measured viewport geometry.
- `src/features/home/components/news-card.tsx`: news-card presentation; shared date formatter unchanged.

Existing unrelated working-tree changes were not modified.
