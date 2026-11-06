# CHEF'S BURGER mobile refinement

Branch: `codex/mobile-optimization-taste`, based on the current default branch `standalone-migration`, commit `f188be76d0632cada6342f43a9a1127e4ed65b4b`.

This is an improvement to the existing storefront. No product, price, CMS document, original photograph, database schema, payment handler, admin-panel source, dependency manifest or lockfile was changed. Nothing was merged or deployed to production.

## Design and implementation

Taste Skill `design-taste-frontend` **v2.1.5** was read from the official `Leonxlnx/taste-skill` tag (commit `12af471`). The supplied request named this version; the repository's latest version is different. The `browser-skill://` link is not exposed by the available skill tools. No ZIP archive was attached. Official skill scripts were executed without modification: `draw.mjs`, `lint.mjs`, `inspect.mjs`.

The draw used `--sector restaurant --tone luxury --have photography,product-photo --keep palette,type`; direction **The dark room**, seed **1542112387**, no redraws. Brand preservation and the existing-page brief take precedence over dealt replacement sections or new imagery. No stock or generated assets, invented copy, prices, hours or reviews were added.

- Consolidated phone hero overrides from four theme sheets into `src/mobile-layout.css`, removing the fixed 520px runway. A viewport-height media stage bounds the original chef and burger; shorter portrait screens get a smaller proportional stage. Chef face and burger remain visible without text overlap.
- Phone hero content is readable immediately, with native touch scrolling and no decorative ember animation or parallax. Desktop animation stays in place. Tablet photography has its own area, separated from the actions; desktop composition at 1024px and above is retained.
- Opaque safe-area bottom navigation replaces the costly floating blur on phones. Page padding keeps the final content reachable. The dock hides during text input. Menus close when resizing to desktop, releasing the body scroll lock.
- Product cards use a consistent grid, 44px add controls and more readable text. Categories wrap on phones instead of being cut off horizontally. At 320px, the catalog uses one column.
- Cart controls are 44px; inputs are 16px to avoid iOS focus zoom; product rows and totals wrap within narrow screens. Existing checkout guards remain intact.
- Mobile images use Next's cached optimizer through responsive `<picture>` sources. Desktop retains original image URLs; remote/uploaded CMS images retain their existing path. Actual visible CMS hero media is preloaded on the homepage, including a section background override.
- Removed a blocking stylesheet request for 18 optional Google font families. Bundled brand fonts remain; only optional families selected by CMS are requested. The inline editor loads lazily when opened.
- Fixed ordered-list semantics without changing the pickup instructions. On phones, the location section shows the CMS address and a direct Google Maps link instead of loading a third-party iframe. The desktop iframe remains.

## Visual comparison

All images below come from the local production build, at 390×844. The same original seed content was used before and after.

| View | Before | After |
| --- | --- | --- |
| Hero | [Before](before/hero.png) | [After](after/hero.png) |
| Header | [Before](before/hero.png) | [After](after/hero.png) |
| Expanded navigation | [Before](before/navigation.png) | [After](after/navigation.png) |
| Menu and product cards | [Before](before/menu.png) | [After](after/menu.png) |
| Populated cart and checkout form | [Before](before/cart.png) | [After](after/cart.png) |

Full Inspector screenshot sheets at 1440, 768 and 390px, raw Lighthouse runs and additional viewport evidence are retained in `/workspace/mobile-review`. Every final Inspector sheet was opened and visually reviewed. The design critiques and correction rounds are recorded in [critique.md](critique.md).

## Verification

- `npm run build`: passed with Node 22.23.4, Next 16.3.4, `CMS_LOCAL_SEED=true`.
- `npm run typecheck`: passed.
- `npm run check:files`: passed.
- `npm run test:cms`: **35 passed**, no skipped checks.
- Browser regression: **52 route/viewport checks passed**, covering `/`, `/menu`, a product route and `/cart` at 320, 360, 375, 390, 414, 430, 768, 820, 1024 and 1440px, plus 844×390 and 667×375 landscape and 390×600 short portrait. No horizontal page overflow or browser JavaScript errors.
- Portrait hero actions were measured above the fixed dock, including 320×640 and 375×667. Resize from an open phone menu to desktop releases the scroll lock.
- Open/close menu, Escape/focus return, route navigation, category filtering, product detail, adding, incrementing, decrementing, removing, empty cart, form validation, dock hiding on focus and reduced motion passed.
- Safe checkout checks covered the real disabled configuration and a browser-intercepted test configuration/session failure; error display and re-enabled submit passed. No order or payment was sent. **A real Stripe test transaction was not run:** no Stripe or payment-database credentials are configured.
- Seed content and CMS validation are verified. Authenticated editing, Neon persistence and Blob upload were not exercised because credentials are absent.
- Chromium touch/viewport emulation was used, not a physical Android/iPhone. Native iOS Safari and nonzero hardware notch insets were unavailable; CSS safe-area behavior is implemented but must also be checked on a physical iPhone.
- The restricted environment blocks the existing desktop Google Maps iframe. This is an environment limitation; the phone's direct map link remains usable without embedding a blocked frame.

## Taste results and limits

The unfiltered baseline Inspector reported **12 FAIL / 7 WARN**. The final Inspector reported **12 FAIL / 7 WARN**, with JSON included alongside this report. This is not a zero-FAIL Taste gate: preserved desktop decoration and source content conflict with the skill's house rules (eyebrows, decorative numbering, gradients, shadows, small labels and outlines). Rebuilding the desktop or rewriting CMS copy merely to clear those checks would violate the brief. The mobile horizontal category clipping and covered-text finding were addressed. No rule was hidden from the inspector.

The linter also reports `box-shadow: none`, `text-shadow: none` and `backdrop-filter: none` as pattern matches. These remove effects. Its gradient matches include the neutral photo scrim and alpha masks needed for the explicitly requested photo blending. Other retained hero markup belongs to the unchanged desktop presentation. These findings are disclosed, not described as passes. The final critique uses the skill's 6.0 overall cap while FAILs remain.

## Review and publishing

Local production validation is complete for the seed storefront. A public preview is not available through this environment's tools; no localhost preview link is presented. GitHub API access was denied (`Forbidden`); `api.github.com` is absent from the running allowlist. Its addition was saved to the environment draft, preserving package-manager presets. Review and save that change in environment settings to apply access, then retry PR creation. No credential value is requested in chat.

Environment onboarding also saved `install_script` and `start_skill`; publishing that environment snapshot remains a separate user action. Saving the draft does not publish the application or environment.

## Measured mobile performance

Lighthouse 13.6.0, mobile preset with simulated throttling, local production build, same cloud machine. These are single local lab runs, not field measurements. Raw runs are retained in /workspace/mobile-review.

| Measure | Before | After |
| --- | ---: | ---: |
| Performance | 67 | 80 |
| Accessibility | 93 | 96 |
| Best Practices | 96 | 100 |
| SEO | 100 | 100 |
| LCP | 6.6 s | 4.3 s |
| CLS | 0 | 0 |
| Total blocking time | 360 ms | 250 ms |
| Transferred resources | 1167 KiB | 552 KiB |
| Transferred JavaScript | 229.9 KiB | 234.6 KiB |

**Performance 90+ and LCP below 2.5s were not reached.** The storefront still waits for its client-rendered React application. A larger rendering architecture change would need a separately reviewed CMS/router refactor. No field INP measurement is available; TBT must not be presented as INP. Accessibility's remaining contrast finding concerns the existing decorative pickup step numbers. Native Safari, real device INP, and real Stripe confirmation remain unverified.

Additional slow-network check: at 150ms latency, 200,000 bytes/s download and 4× CPU slowdown, both hero photographs decoded and the primary action became visible in **4172ms**. This is a synthetic check, not field INP. The actual tablet hero h1 measured **38.4px**; the Inspector's focal-point heuristic reports a different nested text size. The screenshot and DOM measurements are both retained. The final desktop fold's mean pixel difference from the baseline is **0.142/255**, predominantly the live decorative effect, supporting visual preservation.

JavaScript transfer increased by about **4.7 KiB** in the recorded runs as responsive image handling was added. The net resource saving comes from smaller mobile photographs and removal of unused font loading; this is not a claim that the JavaScript bundle shrank.
