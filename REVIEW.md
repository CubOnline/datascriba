# REVIEW.md — Phase 6: Scheduler & Dağıtım

**Reviewer:** code-review agent
**Date:** 2026-05-15
**Status:** APPROVED_WITH_FIXES

---

## Kritik Sorunlar (C-*)

### C-1 — SMTP Hatası Job'ı Öldürüyordu [DÜZELTILDI]

**Dosya:** `apps/worker/src/processors/run-report.processor.ts`

**Sorun:** `emailService.sendReportEmail()` doğrudan `await` ediliyordu, herhangi bir try/catch olmaksızın. SMTP sunucusu yanıt vermezse veya kimlik doğrulama başarısız olursa, hata BullMQ'ya yayılır; bu da başarıyla oluşturulan raporu "failed" olarak işaretler ve işi 3 kez yeniden dener (`attempts: 3`, `backoff: exponential`). Her yeniden denemede rapor yeniden üretilir ve potansiyel olarak birden fazla e-posta gönderilir.

**Düzeltme:** E-posta bloğu `try/catch` içine alındı. SMTP hatası `logger.error` ile loglanır fakat iş başarılı sayılmaya devam eder. Bu CLAUDE.md'deki "Hata yutma yasak — log ve re-throw" kuralıyla da uyumludur: hata loglanır, job'a re-throw yapılmaz çünkü e-posta ikincil bir bildirimdir, işin kendisi değildir.

**Referans:** CLAUDE.md — "E-posta servisi hata durumunu doğru handle ediyor mu? (SMTP hatası rapor işlemini durdurmamalı)"

---

### C-2 — Redis Production'da Unauthenticated Çalışıyordu [DÜZELTILDI]

**Dosya:** `docker/docker-compose.yml`

**Sorun:** Redis servisi `requirepass` olmadan başlatılıyordu. Aynı Docker ağındaki herhangi bir konteyner ya da ağa erişim sağlayan biri, BullMQ kuyruğunu okuyabilir, değiştirebilir veya silebilirdi. Job payload'ları `reportId`, `notifyEmail` ve `parameters` gibi hassas veriler içermektedir.

**Düzeltme:** Redis servisi, `REDIS_PASSWORD` env değişkeni tanımlıysa `--requirepass` argümanıyla başlayacak şekilde güncellendi. Healthcheck de şifreli `redis-cli` ping kullanacak şekilde güncellendi. `.env` dosyası zaten `.gitignore`'da bulunmaktadır. Yerel geliştirme için boş şifre (eski davranış) korunmaktadır; production ortamında `REDIS_PASSWORD` mutlaka ayarlanmalıdır.

---

## Uyarılar (W-*)

### W-1 — CI'da ENCRYPTION_MASTER_KEY Hardcode Test Değeri

**Dosya:** `.github/workflows/ci.yml` satır 61

**Değer:** `0000000000000000000000000000000000000000000000000000000000000000`

**Durum:** Bu değer yalnızca test ortamı içindir ve gerçek veri şifrelemez. Yine de bu tür değerlerin `${{ secrets.ENCRYPTION_MASTER_KEY_TEST }}` gibi bir GitHub Actions secret'ı aracılığıyla sağlanması tercih edilir. Şu anki haliyle düşük risk, orta seviye kod kalitesi sorunu.

**Öneri:** `ENCRYPTION_MASTER_KEY` için bir GitHub repo secret oluşturun ve CI workflow'da `${{ secrets.ENCRYPTION_MASTER_KEY }}` kullanın.

---

### W-2 — Postgres Şifresi Hardcode (docker-compose)

**Dosya:** `docker/docker-compose.yml` satır 9-11

```yaml
POSTGRES_USER: datascriba
POSTGRES_PASSWORD: datascriba
POSTGRES_DB: datascriba
```

**Durum:** Compose dosyasındaki bu değerler yerel geliştirme için kabul edilebilir. `.env` gitignore'da bulunduğundan secret sızması riski yoktur. Ancak production için `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` şeklinde env var referansı kullanılarak `.env` dosyasından okunması önerilir.

---

### W-3 — SSRF Kısmi Koruma (INTERNAL_API_URL)

**Dosya:** `apps/worker/src/services/report-runner.service.ts` satır 56, `apps/worker/src/config/worker-env.ts` satır 9

**Durum:** `INTERNAL_API_URL`, `z.string().url()` ile Zod tarafından doğrulanmaktadır — bu, rastgele URL şemalarını engeller. `reportId` alanı Zod şemasında `z.string().uuid()` ile validate edilmektedir, bu da path traversal'ı (`../../../etc/passwd` gibi) engeller. Mevcut koruma yeterli olmakla birlikte, gelecekte `INTERNAL_API_URL`'nin allowlist'e alınması (sadece `http://api:` önekini kabul etmek gibi) daha sağlam bir yaklaşım olacaktır.

---

### W-4 — Multi-Pod Race Condition (Gelecek Faz)

**Dosya:** `apps/api/src/modules/schedule/schedule.service.ts` satır 112-145

**Durum:** Birden fazla API pod'u çalışırsa `@Cron('* * * * *')` her pod'da tetiklenir ve aynı schedule birden fazla job'a dönüşebilir. Şu anki in-memory store fazında tek bir process çalıştığından bu sorun değildir. Prisma entegrasyonu yapıldığında (sonraki faz) atomic `UPDATE ... WHERE nextRunAt <= NOW() AND processing = FALSE` ya da BullMQ'nun `jobId` deduplication özelliği kullanılmalıdır.

---

## Öneriler (S-*)

### S-1 — Cron Validation Güçlendirilebilir

**Dosya:** `apps/api/src/modules/schedule/dto/create-schedule.dto.ts`

**Durum:** `cronExpression` doğrulaması `@MinLength(9)` + `cron-parser` parse başarısına dayanmaktadır. Bu yeterlidir çünkü `cron-parser` geçersiz ifadeleri reddeder. Injection riski de yoktur — cron ifadesi SQL sorgusuna veya shell komutuna gömülmemektedir, yalnızca `parseExpression()` ve in-memory scheduler'a geçilmektedir.

**İyileştirme:** Custom class-validator decorator ile whitelist (`[0-9*,/\- ]` karakterleri) eklenebilir. Bu, kütüphane güvenlik açığı durumunda ek bir savunma katmanı sağlar.

---

### S-2 — E-posta Header Injection — Yeterince Mitigate Edilmiş (Olumlu)

**Durum:** `notifyEmail` alanı hem API DTO'sunda (`@IsEmail()`) hem de Zod şemasında (`z.string().email()`) ve frontend formunda (Zod resolver + `type="email"`) doğrulanmaktadır. Nodemailer `\r\n` içeren adresleri zaten reddeder. Katmanlı koruma yeterlidir.

---

### S-3 — deploy.yml Image Tag Commit SHA Kullanıyor (Olumlu)

**Dosya:** `.github/workflows/deploy.yml`

`docker/metadata-action` ile `type=sha,prefix=sha-` tag'i oluşturulmaktadır. Her deployment'ın tam olarak hangi commit'ten inşa edildiği izlenebilirdir. Güvenlik açısından olumlu.

---

### S-4 — Dockerfile Non-Root USER node (Olumlu)

**Dosya:** `apps/api/Dockerfile`, `apps/worker/Dockerfile`

Her iki Dockerfile'da da production stage'inde `USER node` direktifi bulunmaktadır. Container privilege escalation riski minimize edilmiştir.

---

### S-5 — BullMQ Job Payload Runtime Zod Validation (Olumlu)

**Dosya:** `apps/worker/src/processors/run-report.processor.ts`, `packages/queue-config/src/run-report-job.schema.ts`

`RunReportJobSchema.safeParse(job.data)` ile runtime doğrulama yapılmaktadır. Malformed payload'lar tutarlı bir hata mesajıyla reddedilmektedir. TypeScript `any` tipi yerine `Job<unknown>` kullanılmıştır. CLAUDE.md standardıyla uyumludur.

---

### S-6 — `@Cron` Decorator Doğru Kullanımı (Olumlu)

**Dosya:** `apps/api/src/modules/schedule/schedule.service.ts` satır 112

`@Cron('* * * * *')` ile dakika bazlı dispatcher doğru yapılandırılmıştır. `NestScheduleModule.forRoot()` `app.module.ts`'de kayıtlıdır. Hata yönetimi her schedule için try/catch ile sarılmıştır — bir schedule'ın başarısız olması diğerlerini etkilemez.

---

### S-7 — `any` Tipi Kullanımı Yok (Olumlu)

Tüm incelenen dosyalarda `any` tipi tespit edilmemiştir. CLAUDE.md standardıyla uyumludur.

---

### S-8 — `console.log` Yok (Olumlu)

Tüm incelenen `.ts` dosyalarında `console.log` kullanımı tespit edilmemiştir. NestJS `Logger` servisi kullanılmaktadır. `worker-env.ts`'deki `process.stderr.write()` kullanımı kabul edilebilirdir — bu bir Logger bağımlılığı olmaksızın erken startup hata raporlamasıdır. CLAUDE.md standardıyla uyumludur.

---

### S-9 — CI Redis Service Konfigürasyonu Yeterli (Olumlu)

**Dosya:** `.github/workflows/ci.yml` satır 47-56

Redis 7 Alpine image kullanılmakta, health check tanımlı ve port doğru eşleştirilmiştir. `REDIS_HOST: 127.0.0.1` ile servis erişimi doğrudur.

---

### S-10 — Secret Sızması Riski Yok (Olumlu)

- SMTP şifresi (`SMTP_PASS`) loglanmıyor.
- Redis şifresi (`REDIS_PASSWORD`) loglanmıyor.
- Queue connection config'i log'a düşmüyor.
- `ENCRYPTION_MASTER_KEY` loglanmıyor.
- `.env` dosyası `.gitignore`'da bulunuyor.
- deploy.yml'de yalnızca `${{ secrets.GITHUB_TOKEN }}` kullanılıyor, hardcode secret yok.

---

## Düzeltilen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `apps/worker/src/processors/run-report.processor.ts` | Email bloğu try/catch ile sarıldı (C-1) |
| `docker/docker-compose.yml` | Redis `REDIS_PASSWORD` env var ile auth desteği eklendi (C-2) |

## Type-Check Sonuçları

| Paket | Komut | Sonuç |
|-------|-------|-------|
| API | `pnpm --filter=api type-check` | PASS — hata yok |
| Worker | `pnpm --filter=worker type-check` | PASS — hata yok |
| Web | `pnpm --filter=web type-check` | PASS — hata yok |

---

## Özet

Faz 6 implementasyonu genel olarak güçlü bir güvenlik ve kalite temeline sahiptir. Cron injection, e-posta header injection ve path traversal için mevcut savunmalar yeterlidir. BullMQ Zod runtime validation, non-root Docker user, structured logging ve `any` yasağına uyum olumlu bulgular arasındadır.

**2 kritik sorun tespit edildi ve düzeltildi:**

1. **C-1:** SMTP hatasının BullMQ job retry döngüsüne yol açması — gereksiz rapor yeniden üretimi ve potansiyel duplicate email riski ortadan kaldırıldı.
2. **C-2:** Production Redis'in unauthenticated çalışması — `REDIS_PASSWORD` env var ile opsiyonel auth desteği eklendi.

Tüm type-check'ler sorunsuz geçmektedir. Tester fazına ilerlenebilir; yalnızca W-4 (multi-pod race condition) Prisma entegrasyonu öncesinde takibe alınmalıdır.
