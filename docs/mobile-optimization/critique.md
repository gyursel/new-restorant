# Taste v2.1.5 review

Source: Leonxlnx/taste-skill tag v2.1.5, commit 12af471. SKILL.md, layout, type, colour, imagery, motion and critique references read. `draw.mjs`, `lint.mjs` and `inspect.mjs` executed unchanged. No kit file modified.

Direction: The dark room, seed 1542112387, `--keep palette,type`. Chosen for the actual dark restaurant identity, MARTIN portrait and lit burger. No redraw. The existing-page brief takes precedence over random section blueprints, stock photographs, new copy, new scroll scenes, or changes to desktop. No found, generated or substituted imagery. Live thing: existing category filtering and cart.

Inventory: CHEF'S BURGER wordmark, original flame mark, MARTIN uniform portrait, original lit sesame burger, Bulgarian copy, Onest, orange action colour, warm black ground, 17 CMS seed products, Varna address, pickup ordering, original category names and prices.
Claims retained: hero shows the chef and burger → actual photographs; menu offers product selection → unchanged CMS catalog and prices; offers → existing CMS promotions; pickup instructions → existing steps; visit → actual CMS address/hours/contact; order → existing cart and guarded checkout. Copy and content remain unchanged.

ROUND 0 (before)
Seen in one second: chef portrait and burger; action below fold at 390px.
Idea (one sentence): MARTIN's portrait and original burger form a shared, dark photographic stage.
Live thing: real menu filtering and cart.
Layout words by section: hero=overlap / featured=grid / menu=grid / offers=photo / steps=list / location=split / footer=links.
Scores: design 6.5 · usability 6 · creativity 6 · content 7 → overall 6.0 (capped).
Caps applied: Inspector FAILs; existing gradient text, eyebrows, three-line hero and decorative rules are protected desktop/content conventions.
Top three problems (most visible first), each with screenshot and fix:
1. before/mobile-fold.jpg: 520px fixed image runway sends main CTA below fold. Replace it with a viewport-relative media stage.
2. before/tablet-fold.jpg: burger approaches CTA; retain desktop but bound phone composition independently.
3. before/mobile-page-01.jpg: dock samples a large blurred region; cards have undersized 38px add targets. Use an opaque safe-area bar and 44px controls.

ROUND 1
Seen in one second: oversized burger hides chef's face.
Idea (one sentence): MARTIN's portrait and original burger form a shared, dark photographic stage.
Live thing: real menu filtering and cart.
Layout words by section: hero=overlap / featured=grid / menu=grid / offers=photo / steps=list / location=split / footer=links.
Scores: design 6 · usability 7 · creativity 6 · content 7 → overall 6.0 (capped).
Caps applied: remaining Inspector FAILs, retained desktop identity.
Top three problems (most visible first), each with screenshot and fix:
1. round-1/hero.png: burger covers MARTIN's face. Reduce burger height to 78% of media stage and place chef farther left.
2. round-1/menu.png: card descriptions and add targets too compact. Increase body sizes and targets; retain two columns except 320px.
3. round-1/cart.png: quantity/removal row needs more room; use a two-column product layout and full-sized form inputs, hide dock during text entry.

ROUND 2
Seen in one second: chef's face and complete original burger, with a readable title and visible CTA at 390px.
Idea (one sentence): MARTIN's portrait and original burger form a shared, dark photographic stage.
Live thing: real menu filtering and cart.
Layout words by section: hero=overlap / featured=grid / menu=grid / offers=photo / steps=list / location=split / footer=links.
Scores: design 7.5 · usability 7.5 · creativity 7 · content 7 → overall 6.0 (Inspector cap).
Caps applied: unfiltered Inspector retains pre-existing house-style conflicts outside the mobile scope; do not claim a zero-FAIL gate.
Top three problems (most visible first), each with screenshot and fix:
1. Functional viewport evidence: dock covers CTA on short portrait devices. Use a 25svh media stage below 700px height, with proportionate chef sizing.
2. round-2/hero.png: blurred and glowing mobile surfaces remain expensive. Flatten mobile surfaces; retain the original desktop theme.
3. Lighthouse: image discovery waits for client app and 18 external fonts block styling. Server-preload actual CMS hero media, use responsive mobile sources, fetch only selected optional fonts, defer inline-editor JavaScript.

ROUND 3 (final production render)
Seen in one second: MARTIN and the full burger above a readable phone title and visible actions; tablet actions have a separate left column.
Idea (one sentence): MARTIN's portrait and original burger form a shared, dark photographic stage.
Live thing: real category filtering and cart operations.
Layout words by section: hero=overlap (phone)/split (tablet) / featured=grid / menu=grid / offers=photo / steps=list / location=address / footer=links.
Scores: design 7.5 · usability 8 · creativity 7 · content 7 → overall 6.0 (Inspector cap).
Caps applied: final unfiltered Inspector 12 FAIL / 7 WARN; preserved desktop styles and copy, including three-line hero wording. All final screenshots, including every page sheet, were opened.
Top three remaining problems (most visible first), each with screenshot and disposition:
1. final/tablet-fold.jpg: tablet photographs are less dominant than the phone pair. The Inspector adds `focal-point`; its stated 24.6px title is not the actual hero h1, measured separately at 38.4px in supplement.json. The tablet tradeoff prevents the original burger/action collision. Retained after three correction rounds.
2. final/desktop-page-02.jpg and tablet-page-02.jpg: the original embedded Google map is blocked by environment networking. Phone location is now an address card with a genuine Maps link; desktop preservation keeps the embed.
3. final/mobile-page-02.jpg: original pickup step numbers remain visually faint; Lighthouse accessibility is 96. Preserved as decorative content rather than rewritten to chase a style score.

Other rule dispositions: the no-hero warning overlooks the visibly rendered nested-span h1 (also on the baseline); side-scroll remains only at 768px for the original tablet category scroller, with all controls keyboard reachable and no page overflow. Desktop glow, outlines, gradient headline and labels remain explicit brand/scope exceptions, never hidden with Inspector allow flags. The phone has readable controls, bounded images and no horizontal page overflow. No stock images, generated pictures, new scenes, or invented text were introduced. No further visual rounds were performed.
