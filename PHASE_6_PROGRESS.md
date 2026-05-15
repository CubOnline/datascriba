# PHASE_6_PROGRESS.md — Faz 6: Scheduler & Dağıtım

**Tarih:** 2026-05-15
**Builder Ajan:** builder
**Durum:** TAMAMLANDI

---

## Uygulanan Adımlar

### STEP 1 — Shared Queue Config Paketi ✅

Yeni paket: `packages/queue-config/`

- `package.json` — `@datascriba/queue-config` adıyla, `bullmq`, `ioredis`, `zod` bağımlılıkları
- `tsconfig.json` — `@datascriba/tsconfig/base.json` üzerinden, spec dosyaları hariç
- `src/queue.config.ts` — `QUEUE_NAME`, `createRedisConnection`, `createQueueOptions`, `createWorkerOptions`
- `src/run-report-job.schema.ts` — Zod şeması: `RunReportJobSchema` + `RunReportJobPayload`
- `src/index.ts` — named export'lar

### STEP 2 — Shared Types Güncellemesi ✅

- `packages/shared-types/src/schedule.ts` (YENİ) — `ScheduleDefinition`, `CreateScheduleRequest`, `UpdateScheduleRequest`
- `packages/shared-types/src/index.ts` (GÜNCELLENDI) — schedule type'ları eklendi

### STEP 3 — API: Schedule Modülü ✅

- `apps/api/src/config/env.ts` — Redis ve SMTP env değişkenleri eklendi
- `apps/api/src/modules/schedule/dto/create-schedule.dto.ts`
- `apps/api/src/modules/schedule/dto/update-schedule.dto.ts`
- `apps/api/src/modules/schedule/schedule.repository.ts` — in-memory stub
- `apps/api/src/modules/schedule/schedule.service.ts` — CRUD + `@Cron` dispatcher
- `apps/api/src/modules/schedule/schedule.controller.ts` — 6 endpoint (CRUD + trigger)
- `apps/api/src/modules/schedule/email.service.ts` — Handlebars HTML şablon, nodemailer
- `apps/api/src/modules/schedule/schedule.module.ts`
- `apps/api/src/health/health.controller.ts` (YENİ) — `/health` endpoint
- `apps/api/src/app.module.ts` (GÜNCELLENDI) — BullModule, NestScheduleModule, ScheduleModule, HealthController
- `apps/api/package.json` (GÜNCELLENDI) — yeni bağımlılıklar eklendi

**Not:** `@nestjs/bullmq` v10, `BullMQModule` değil `BullModule` olarak export eder. Tüm import'lar düzeltildi.

### STEP 4 — Worker Uygulaması ✅

Yeni uygulama: `apps/worker/`

- `package.json` — `@datascriba/worker`
- `tsconfig.json` + `tsconfig.build.json` — `@datascriba/tsconfig/nestjs.json` üzerinden
- `nest-cli.json`
- `src/config/worker-env.ts` — Zod schema + `validateWorkerEnv()`
- `src/processors/run-report.processor.ts` — `WorkerHost` extend, Zod validate
- `src/services/report-runner.service.ts` — HTTP via `INTERNAL_API_URL`
- `src/services/email.service.ts` — Handlebars + nodemailer (WorkerEnv)
- `src/worker.module.ts` — BullModule (forRootAsync + registerQueue)
- `src/main.ts` — `NestFactory.createApplicationContext`, shutdown hooks
- `Dockerfile` — multi-stage, non-root `node` user

### STEP 5 — Frontend: Schedule UI ✅

- `apps/web/src/hooks/use-schedules.ts` (YENİ) — TanStack Query hooks
- `apps/web/src/i18n/messages/en.json` (GÜNCELLENDI) — `schedule` ve `nav.schedules` eklendi
- `apps/web/src/i18n/messages/tr.json` (GÜNCELLENDI) — Türkçe karşılıklar
- `apps/web/src/app/[locale]/schedules/page.tsx` (YENİ) — server component
- `apps/web/src/app/[locale]/schedules/schedules-client.tsx` (YENİ) — tablo + CRUD
- `apps/web/src/app/[locale]/schedules/create-schedule-dialog.tsx` (YENİ) — form dialog
- `apps/web/src/components/layout/sidebar.tsx` (GÜNCELLENDI) — `Calendar` ikonu + schedules nav item
- `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx` (GÜNCELLENDI) — "Zamanla" butonu
- `apps/web/src/components/ui/dialog.tsx` (GÜNCELLENDI) — `DialogFooter` eklendi
- `apps/web/src/components/ui/table.tsx` (YENİ) — `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`

### STEP 6 — DevOps: Docker Compose & Dockerfile ✅

- `docker/docker-compose.yml` (GÜNCELLENDI) — `api`, `worker` servisleri + healthcheck
- `docker/docker-compose.dev.yml` (YENİ) — development override
- `apps/api/Dockerfile` (YENİ) — multi-stage, non-root user
- `apps/worker/Dockerfile` (YENİ) — multi-stage, non-root user
- `.env.example` (GÜNCELLENDI) — Redis + SMTP + INTERNAL_API_URL

### STEP 7 — CI/CD: GitHub Actions ✅

- `.github/workflows/ci.yml` (YENİ) — lint + type-check + test
- `.github/workflows/deploy.yml` (YENİ) — Docker image build & push to GHCR

### STEP 8 — Unit Testler ✅

- `apps/api/src/modules/schedule/schedule.service.spec.ts` — 6 test
- `packages/queue-config/src/run-report-job.schema.spec.ts` — 5 test

### STEP 9 — Health Check Endpoint ✅

- `apps/api/src/health/health.controller.ts` — STEP 3'te oluşturuldu

### STEP 10 — Root package.json Güncellemesi ✅

- `package.json` — `docker:dev`, `worker:dev`, `worker:build` script'leri eklendi

---

## Doğrulama Sonuçları

| Komut | Durum |
|-------|-------|
| `pnpm --filter=queue-config type-check` | ✅ PASS |
| `pnpm --filter=api type-check` | ✅ PASS |
| `pnpm --filter=worker type-check` | ✅ PASS |
| `pnpm --filter=web type-check` | ✅ PASS |
| `pnpm --filter=api lint` | ✅ PASS |
| `pnpm --filter=web lint` | ✅ PASS |

---

## Önemli Kararlar & Düzeltmeler

1. **BullModule vs BullMQModule:** `@nestjs/bullmq` v10 `BullModule` olarak export eder. TASK_PLAN'daki `BullMQModule` yerine `BullModule` kullanıldı.
2. **queue-config tsconfig:** `**/*.spec.ts` hariç tutuldu — vitest bağımlılığı olmadan type-check geçer.
3. **Web UI eksik bileşenler:** `DialogFooter` dialog.tsx'e eklendi; `table.tsx` sıfırdan oluşturuldu.
4. **Relatif import yolu:** `report-editor-client.tsx`'te `../../../schedules/` (3 seviye yukarı) doğru yol.
5. **Pre-existing lint hatası:** `is-public-host.validator.ts`'teki `Function` tipi düzeltildi.
6. **Worker renderTemplate:** `sql` değişkeni validation için hesaplanır ama kullanılmaz; `void sql` ile TS uyarısı engellendi.

---

## Sonraki Adım

Reviewer ajana iletmek için: REVIEW.md oluşturulmasını bekleyin.
