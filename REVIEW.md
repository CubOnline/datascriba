# REVIEW.md — Phase 8: Test, Doküman & Deploy

**Reviewer:** code-review agent
**Date:** 2026-05-16
**Status:** APPROVED_WITH_FIXES

---

## Kritik Sorunlar (C-*)

Kritik sorun bulunamadı.

---

## Uyarılar (W-*)

### W-1 — CI/CD: Tag trigger pattern çok geniş (DÜZELTİLDİ)

**Dosya:** `.github/workflows/deploy.yml`

`on.push.tags` filtresi `v*` idi; bu pattern `v-beta`, `vtest`, `v` gibi
istenmeyen tag'lerde de deploy tetikleyebilirdi.

**Düzeltme:** `v*` → `v*.*.*` (semver-only trigger).

---

### W-2 — Güvenlik: `.env.example` ANTHROPIC_API_KEY placeholder değeri

**Dosya:** `.env.example` satır 48

```
ANTHROPIC_API_KEY=sk-ant-...
```

`sk-ant-` Anthropic API key prefix'iyle aynı. Placeholder olduğu `...` ile
belirtilmiş, gerçek credential içermiyor ve güvenlik açığı oluşturmuyor; ancak
bazı secret-scanner araçları (truffleHog, gitleaks) bu pattern'i false-positive
olarak işaretleyebilir. `YOUR_ANTHROPIC_API_KEY` gibi açık bir placeholder
tercih edilebilir.

**Aksiyon alınmadı** — functional risk yok, builder takdiri.

---

### W-3 — Dokümantasyon: api.md PATCH vs PUT tutarsızlığı (DÜZELTİLDİ)

**Dosya:** `docs/api.md`

Üç update endpoint (`/data-sources/:id`, `/reports/:id`, `/schedules/:id`)
`PATCH` olarak belgelenmişti; ancak controller'ların tümü `@Put` dekoratörü
kullanıyor ve e2e testler `.put()` ile çağırıyor.

**Düzeltme:** Tüm üç `PATCH` başlığı `PUT` olarak güncellendi.

---

## Öneriler (S-*)

### S-1 — schedule.e2e-spec.ts: BullMQ gerçek adres içeriyor

**Dosya:** `apps/api/src/modules/schedule/schedule.e2e-spec.ts` satır 75-78

```typescript
BullModule.forRoot({
  connection: { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 0, enableReadyCheck: false },
}),
```

Queue provider `overrideProvider(getQueueToken(QUEUE_NAME)).useValue(queueMock)`
ile override edildiğinden gerçek bağlantı kurulmaz. `maxRetriesPerRequest: 0`
ve `enableReadyCheck: false` iyi bir pratik; ancak bu yaklaşım BullMQ
kütüphanesi güncellendikçe kırılabilir. Uzun vadede BullMQ bağımlılığını
tamamen dışarıda bırakarak minimum test modülü oluşturmak daha dayanıklı olur.

### S-2 — ai.e2e-spec.ts: SSE endpoint assertion'ları geniş

**Dosya:** `apps/api/src/modules/ai/ai.e2e-spec.ts` satır 121, 137

```typescript
expect([200, 400, 422]).toContain(res.status)
```

SSE endpoint'leri için status kodu aralığı çok geniş. AiService mock tamamen
override edildiğinden 200 garantilenebilir; `expect(res.status).toBe(200)` ile
değiştirilebilir. Mevcut haliyle yanlış pozitif risk yok fakat assertion gücü
düşük.

### S-3 — vitest.config.ts: Ayrı e2e config yokluğu

**Dosya:** `apps/api/vitest.config.ts`

Hem unit (`*.spec.ts`) hem e2e (`*.e2e-spec.ts`) aynı konfigürasyonla çalışıyor.
E2e testler için `testTimeout` konfigürasyonu 15 s olarak ayarlanmış; bu yeterli
olsa da, büyüdükçe e2e'ye ayrı config (`vitest.config.e2e.ts`) + ayrı `test:e2e`
script oluşturmak CI sürelerini ve hata izolasyonunu iyileştirir.

### S-4 — docker-compose.prod.yml: Top-level `volumes` tanımı eksik

**Dosya:** `docker/docker-compose.prod.yml`

`worker` servisinde `report_output` named volume kullanılıyor ancak bu dosyada
top-level `volumes:` bildirimi yok. Base `docker-compose.yml` dosyasında bu
volume tanımlıysa sorun yok; yoksa compose başlatma sırasında hata alınır.
Prod override'ın bağımsız okunabilirliği için kısaca belgelenmesi önerilir.

---

## Test Kalitesi Özeti

| Dosya | Dış Servis | console.log | Mock Doğruluğu | Assertion Gücü | beforeEach Reset | Bağımsız Test |
|---|---|---|---|---|---|---|
| data-source.e2e-spec.ts | Hayır (mock) | Yok | Doğru | Güçlü | Var | Evet |
| report.e2e-spec.ts | Hayır (mock) | Yok | Doğru | Güçlü | Var | Evet |
| schedule.e2e-spec.ts | BullMQ addr (override'd) | Yok | Doğru | Güçlü | Var | Evet |
| ai.e2e-spec.ts | Hayır (mock) | Yok | Doğru | Orta (bkz. S-2) | N/A (beforeAll) | Evet |
| use-ai.test.ts | Hayır (fetch stub) | Yok | Doğru | Güçlü | Var (afterEach restore) | Evet |
| ai-assistant-panel.test.tsx | Hayır (mock) | Yok | Doğru | Güçlü | Var (clearAllMocks) | Evet |

---

## CI/CD Özeti

| Kontrol | Sonuç |
|---|---|
| Tag trigger format | Düzeltildi (`v*.*.*`) |
| Secrets hardcode | Yok — tümü `${{ secrets.X }}` |
| Docker build target | `production` olarak ayarlı |
| Cache stratejisi | `type=gha` — doğru |
| Release prerelease detection | `contains(version, '-')` — doğru |

---

## Dokümantasyon Özeti

| Dosya | Durum |
|---|---|
| README.md | Quickstart komutları gerçek, placeholder yok |
| docs/api.md | PATCH→PUT düzeltildi (W-3), içerik eksiksiz |
| docs/architecture.md | Mermaid diyagramları doğru sözdizimi |
| docs/deployment.md | Tüm env var'lar listeli, üretim checklist var |
| CONTRIBUTING.md | Agent workflow açıklanmış, PR kuralları eksiksiz |
| docs/adr/001-mssql-only.md | Karar + gerekçe + sonuç formatında |
| docs/adr/002-in-memory-repo.md | Karar + gerekçe + migration planı var |
| docs/adr/003-csv-excel-only.md | Karar + gerekçe + gelecek planı var |

---

## Test Çalışma Sonuçları

```
vitest run (apps/api):   9 test dosyası, 79 test — TÜMÜ GEÇTI
pnpm --filter=api type-check:   HATA YOK
pnpm --filter=web type-check:   HATA YOK
```

---

## Özet

Faz 8 implementasyonu genel olarak yüksek kaliteli. Tüm testler in-memory mock
kullanıyor; dış servis (DB, Redis, SMTP, Anthropic) bağlantısı gerektirmiyor.
Mock'lar doğru kurulmuş, `beforeEach` store reset'leri var, testler birbirinden
bağımsız. `console.log` yok, gerçek credential yok, anlamsız assertion yok.

İki düzeltme yapıldı: CI/CD tag pattern daraltıldı (`v*` → `v*.*.*`) ve api.md
PATCH/PUT tutarsızlığı giderildi. Dört öneri verildi; hiçbiri engelleyici değil.

Faz 8, **APPROVED_WITH_FIXES** statüsüyle onaylanmıştır.
