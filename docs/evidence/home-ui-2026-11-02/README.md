# Home UI browser evidence

These screenshots use an isolated test account and test-only responses/images. They are not sample data added to the application. All API requests are intercepted by `browser-fixture.mjs`.

`result.json` records the completed checks and the development-server interruption. The seven state checks were rerun successfully in a fresh Metro session. `result-states.json` contains that run's direct output.

To repeat the checks, start Metro without loading local environment files:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_ENV=LOCAL EXPO_PUBLIC_LOCAL_PORT=3199 node node_modules/expo/bin/cli start --web --localhost --port 8085
```

From another terminal in `paymi_v2`, run the two groups separately, restarting Metro between them if its SSR cache fails:

```sh
PAYMI_HOME_CHECK_SET=core node docs/evidence/home-ui-2026-11-02/browser-checks.mjs
PAYMI_HOME_CHECK_SET=states node docs/evidence/home-ui-2026-11-02/browser-checks.mjs
```

Set `PAYMI_PLAYWRIGHT_MODULE` to the installed Playwright module path if it differs from the validation machine. `PAYMI_HOME_ORIGIN` can override the default `http://localhost:8085`. Chromium is expected at `/usr/bin/chromium`.

The browser invokes the existing refresh callback and scrolls the horizontal containers. It does not validate native pull gestures, device momentum, pinch-to-zoom, or native screen-reader behavior.
