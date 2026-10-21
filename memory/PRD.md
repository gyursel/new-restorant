# PRD — LILY DRIVE визуален редизайн

## Original problem statement
"iskam saita da go preobrazish i da izglejda tochno kato na snimkata, tam e dadeno na dve mesta izgledaut - kato funkcii ne iskam nishto da promeniash ot moiat sait, prosto vizualno da promenish neshtata"
(Reference: dark glass food-app mockup with orange accents; uploaded restorant.zip — Next.js 16 site)
Choices: apply to all pages; mobile like image + adapted desktop; keep own photos/texts.

## Architecture
- /app/frontend = user's Next.js 16 project (production build via `next start`, rebuild after edits: `npx next build` then restart frontend)
- /app/backend/server.py = preview-only proxy forwarding /api/* to Next (ingress routes /api to 8001)
- Local preview content: `CMS_LOCAL_SEED=true` in .env.local → server/cms.ts uses seed.json when no DATABASE_URL

## Implemented (2026-10-21)
- src/ember-glass.css: dark warm glass + orange theme for header, hero, cards, category tiles, promos, steps, location, product detail, cart, mobile floating dock
- Hero: masked line-by-line headline reveal, scroll parallax, ember particles, orange gradient last line; slow product-name marquee
- Lenis smooth scroll (off in editor / reduced motion); flame logo mark + app/icon.svg favicon; "+" add buttons
- Dev-only additions: allowedDevOrigins, .yarnrc ignore-engines, start script `next start`

## Backlog
- P1: admin panel (/admin) reskin to same style
- P2: category icons in tiles like reference
