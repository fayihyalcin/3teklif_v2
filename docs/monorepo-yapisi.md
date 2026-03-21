# Monorepo Yapisinin Amaci

Bu yapi, 3teklif platformunun web ve API katmanlarini tek depoda yurutmek icin olusturuldu.

## Hedefler

- Roller: super yonetici, firma, musteri
- Moduller: ilan, ihale, teklif, paket, evrak onay
- Hizli gelistirme: tek komutla tum servisleri calistirma
- Ortak tipler: web ve API arasinda uyumlu veri modelleri

## Teknoloji Kararlari

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Veritabani: PostgreSQL + Prisma ORM
- Paket yonetimi: npm workspaces
- Altyapi: Docker Compose (PostgreSQL)

## Servisler Arasi Sinirlar

- `apps/web`: sadece UI ve API client
- `apps/api`: is kurallari, auth, teklif algoritmasi, ihale kurallari
- `packages/shared-types`: API DTO ve enum'lar

## MVP Veri Alanlari (Ilk Faz)

- Kullanici/Firma kayit ve rol yonetimi
- Firma evrak yukleme ve admin onayi
- 15 gun trial ve Plus paket zorunlulugu
- Musteri ilan acma
- Firmalara uygun ilan dagitimi
- Firma teklif girisi
- Musteriye en iyi 3 teklif listesi
