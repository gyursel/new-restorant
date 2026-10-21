# LILY DRIVE — самостоятелна версия

Това е пълният Next.js frontend + API/backend на сайта от експорта на Emergent. Python `backend/server.py` от оригиналния архив е само preview proxy към Next.js и **не е необходим** за Vercel. В тази версия няма Git submodule и няма Emergent preview allowlist.

## Качване в GitHub

Препоръчителен подход: използвай нов празен branch или **ново празно хранилище** за съдържанието на този архив. Не извършвай force push към съществуващите `main` или `master` клонове в `gyursel/new-restorant`: `main` е Emergent wrapper с frontend gitlink, а `master` съдържа различна история. Всички файлове от настоящия архив трябва да са **в корена** на хранилището, а не вътре в `frontend/`.

## Vercel

- Import Git repository в Vercel; Framework Preset: Next.js; Root Directory: `./`.
- Node.js: 22.x (според `package.json`). Build: `npm run build` (или Yarn, ако предпочиташ yarn.lock).
- Настрой `DATABASE_URL` за отделната CMS Neon PostgreSQL база и изпълни `database/schema.sql`.
- Настрой Vercel Blob store и `BLOB_READ_WRITE_TOKEN` за качване на изображения.
- Настрой `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` като секретни променливи във Vercel. Виж `docs/DEPLOY-VERCEL.md`.
- Поръчки/плащания: отделна `PAYMENT_DATABASE_URL` и Stripe настройки; не включвай `ONLINE_ORDERING_ENABLED=true`, преди да си проверил сигурността, уебхуковете и тестовия checkout.
- Не слагай ключове в GitHub и не качвай `.env` файлове.
- Преди смяна на production домейна провери: `/`, `/menu`, `/admin/login`, изображения, редакция/публикуване на меню, мобилно меню, checkout в тестов режим.

## Ограничения

Този архив съдържа **код и статични изображения**, но не и данни от активната външна база, качени в Blob медии, секрети или Stripe настройки. Те трябва да се мигрират/конфигурират отделно. Пълната функционалност не е удостоверена само чрез архивиране.
