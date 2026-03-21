# API Uclari (MVP)

## Auth

- `POST /api/auth/register/customer`
- `POST /api/auth/register/company`
- `POST /api/auth/login`
- `POST /api/auth/bootstrap-admin`
- `GET /api/auth/me`

## Public

- `GET /health`
- `GET /api/sectors`

## Customer Paneli

- `POST /api/customer/listings`
- `GET /api/customer/listings`
- `GET /api/customer/listings/:listingId/top-3`
- `POST /api/customer/tenders`
- `GET /api/customer/tenders`
- `GET /api/customer/tenders/:tenderId/top-3`

## Company Paneli

- `GET /api/company/profile`
- `POST /api/company/documents`
- `GET /api/company/opportunities`
- `POST /api/company/bids`
- `GET /api/company/bids`
- `GET /api/company/tenders/opportunities`
- `POST /api/company/tenders/bids`
- `GET /api/company/tenders/bids`

## Super Admin Paneli

- `GET /api/admin/companies/pending`
- `GET /api/admin/companies`
- `PATCH /api/admin/companies/:companyId/approval`
- `PATCH /api/admin/documents/:documentId/review`
- `POST /api/admin/packages`
- `GET /api/admin/packages`
- `POST /api/admin/subscriptions`
- `PATCH /api/admin/tenders/:tenderId/status`
- `GET /api/admin/dashboard/stats`

