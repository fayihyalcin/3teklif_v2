# Sprint 1 (2 Hafta) - Dosya Bazli Gorevler

## Sprint Amaci

Temel teknik omurgayi kurmak, auth ve rol iskeletini hazirlamak, firma onboarding akisinin backend temelini cikarmak.

## Backlog (Oncelik Sirali)

1. Monorepo altyapisini standartlastir
- Dosyalar: `package.json`, `pnpm-workspace.yaml`, `.editorconfig`, `.gitignore`
- Cikti: tum paketler tek komuttan yonetilebilir olmali.

2. API temelini olustur
- Dosyalar: `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/middleware/error.ts`
- Cikti: API ayaga kalkmali, `/health` endpoint'i calismali.

3. Ortam degiskeni ve guvenli baslangic
- Dosyalar: `apps/api/src/config/env.ts`, `apps/api/.env.example`
- Cikti: zorunlu env alanlari validasyonla kontrol edilmeli.

4. Prisma veri modeli taslagi
- Dosya: `apps/api/prisma/schema.prisma`
- Cikti: roller, kullanici, firma, evrak, paket, abonelik, ilan, teklif, ihale tablolari tanimli olmali.

5. Auth ve rol route iskeleti
- Dosyalar: `apps/api/src/routes/auth.ts`, `apps/api/src/app.ts`
- Cikti: kayit/giris icin placeholder endpoint'ler hazir olmali.

6. Ilan route iskeleti
- Dosyalar: `apps/api/src/routes/listings.ts`, `apps/api/src/app.ts`
- Cikti: ilan olusturma ve listeleme endpoint iskeleti olusmali.

7. Web uygulama iskeleti
- Dosyalar: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/pages/*.tsx`, `apps/web/src/styles.css`
- Cikti: tanitim ve 3 panel route'u calismali.

8. Ortak tip paketi
- Dosya: `packages/shared-types/src/index.ts`
- Cikti: roller, paket tipleri ve temel DTO tipleri ortak kullanilmali.

9. Altyapi (PostgreSQL local)
- Dosya: `infra/docker-compose.yml`
- Cikti: tek komutla local postgres calismali.

10. Teknik dokumantasyon
- Dosyalar: `README.md`, `docs/monorepo-yapisi.md`, `docs/sprint-1-kabul-kriterleri.md`
- Cikti: gelistiricinin 30 dk icinde projeyi ayağa kaldirmasi.

## Sprint 1 Sonu Demo Senaryosu

1. Sistem acilir (`web` + `api` + `postgres`)
2. Health endpoint cevap verir
3. Tanitim ve panel route'lari acilir
4. Ornek auth ve ilan endpoint'leri calisir
5. Prisma schema migration icin hazirdir

