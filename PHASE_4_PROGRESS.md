# PHASE_4_PROGRESS.md

**Faz:** 4 — Görsel Rapor Tasarımcısı
**Durum:** Tamamlandı
**Tarih:** 2026-05-14

## Tamamlanan Adımlar

- [x] STEP-01: apps/web package.json
- [x] STEP-02: tsconfig.json
- [x] STEP-03: next.config.ts
- [x] STEP-04: postcss.config.mjs
- [x] STEP-05: lib/utils.ts
- [x] STEP-06: lib/env.ts
- [x] STEP-07: .env.local
- [x] STEP-08: i18n message dosyaları (en + tr)
- [x] STEP-09: i18n request.ts + routing.ts
- [x] STEP-10: middleware.ts
- [x] STEP-11: lib/api-client.ts
- [x] STEP-12: hooks/use-data-sources.ts
- [x] STEP-13: hooks/use-reports.ts
- [x] STEP-14: store/report-editor.store.ts
- [x] STEP-15: globals.css (TailwindCSS v4)
- [x] STEP-16a-h: UI bileşenleri (button, input, label, select, badge, card, dialog, switch)
- [x] STEP-17: providers.tsx
- [x] STEP-18: layout/sidebar.tsx
- [x] STEP-19: layout/header.tsx
- [x] STEP-20: app/[locale]/layout.tsx
- [x] STEP-21: app/[locale]/page.tsx + app/page.tsx
- [x] STEP-22: data-sources page + client
- [x] STEP-23: data-source-dialog.tsx
- [x] STEP-24: reports page + client
- [x] STEP-25: run-report-dialog.tsx
- [x] STEP-26: reports/new/page.tsx
- [x] STEP-27: report-editor-client.tsx
- [x] STEP-28: parameter-list.tsx (DnD)
- [x] STEP-29: run-history page + client
- [x] STEP-30: settings page
- [x] STEP-31: not-found page
- [x] STEP-32: turbo.json güncelleme
- [x] STEP-33: shared-types DataSourceRecord doğrulama (host, port, database, username eklendi)
- [x] STEP-34: Doğrulama komutları (type-check ve lint hatasız geçti)
- [x] STEP-35: PHASE_4_PROGRESS.md

## Düzeltmeler

- `src/i18n/request.ts`: `Record<string, unknown>` yerine `AbstractIntlMessages` tipi kullanıldı
- `report-editor-client.tsx`: `ReportDefinition.parameters` (id yok) → store `ReportParameter` (id var) dönüşümü map ile yapıldı; `loadReport` selector ile stabil referans alındı
- `packages/shared-types/src/data-source.ts`: `DataSourceRecord`'a `host`, `port`, `database`, `username` alanları eklendi
- `eslint.config.mjs`: ESLint 9 flat config oluşturuldu

## Notlar

- apps/web Next.js 15.3.2 + TailwindCSS v4 + shadcn/ui v2 ile oluşturuldu
- i18n: EN + TR (next-intl v3)
- Dark mode: next-themes
- SQL editörü: Monaco (dynamic import, ssr:false)
- Sürükle-bırak parametre sıralama: @dnd-kit
- Undo/redo: zundo + Zustand
- `pnpm --filter=web type-check` hatasız geçiyor
- `pnpm --filter=web lint` hatasız geçiyor
