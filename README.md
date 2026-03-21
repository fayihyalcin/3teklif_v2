# 3teklif Monorepo

React + Node.js + Express + PostgreSQL tabanli teklif platformu.

## Klasor Yapisi

- `apps/web`: Tanitim sitesi + panel UI (React + Vite + TypeScript)
- `apps/api`: REST API (Node.js + Express + TypeScript + Prisma)
- `packages/shared-types`: Ortak tipler
- `infra`: Altyapi dosyalari (PostgreSQL docker-compose)
- `docs`: Is plani, sprint gorevleri, kabul kriterleri

## Hizli Baslangic

1. `npm install`
2. `docker compose -f infra/docker-compose.yml up -d`
3. `Copy-Item apps/api/.env.example apps/api/.env`
4. `Copy-Item apps/web/.env.example apps/web/.env`
5. `npm run prisma:generate --workspace @uc-teklif/api`
6. `npm run prisma:migrate --workspace @uc-teklif/api`
7. `npm run dev`

## Paneller ve Route'lar

- Public:
- `/` tanitim sitesi
- `/login`
- `/register/customer`
- `/register/company`
- `/admin/setup`
- `/redirect`
- Paneller:
- `/dashboard/customer`
- `/dashboard/company`
- `/dashboard/admin`
- Not: Eski Turkce route'lar yeni adreslere otomatik yonlendirilir.

## API Ozeti

- Auth:
- `POST /api/auth/register/customer`
- `POST /api/auth/register/company`
- `POST /api/auth/login`
- `POST /api/auth/bootstrap-admin`
- `GET /api/auth/me`
- Musteri:
- `POST /api/customer/listings`
- `GET /api/customer/listings`
- `GET /api/customer/listings/:listingId/top-3`
- `POST /api/customer/tenders`
- `GET /api/customer/tenders`
- `GET /api/customer/tenders/:tenderId/top-3`
- Firma:
- `GET /api/company/profile`
- `POST /api/company/documents`
- `GET /api/company/opportunities`
- `POST /api/company/bids`
- `GET /api/company/tenders/opportunities`
- `POST /api/company/tenders/bids`
- Admin:
- `GET /api/admin/companies/pending`
- `PATCH /api/admin/companies/:companyId/approval`
- `PATCH /api/admin/documents/:documentId/review`
- `POST /api/admin/packages`
- `POST /api/admin/subscriptions`
- `GET /api/admin/dashboard/stats`

## Referans Dokumanlar

- `docs/monorepo-yapisi.md`
- `docs/sprint-1-gorevleri.md`
- `docs/sprint-1-kabul-kriterleri.md`
- `docs/api-uclari.md`
