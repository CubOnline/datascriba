# 🚀 DataScriba — Project Roadmap

> **DataScriba** — *Your AI-powered data scribe*
> Modern, AI destekli, mobil uyumlu açık kaynak raporlama platformu.

---

## 📋 İçindekiler

1. [Proje Özeti](#proje-özeti)
2. [Teknoloji Stack](#teknoloji-stack)
3. [Mimari Genel Bakış](#mimari-genel-bakış)
4. [Faz 0 — Analiz & Hazırlık](#faz-0--analiz--hazırlık)
5. [Faz 1 — Temel Altyapı](#faz-1--temel-altyapı)
6. [Faz 2 — Veri Kaynağı Yönetimi](#faz-2--veri-kaynağı-yönetimi)
7. [Faz 3 — Rapor Motoru (Core Engine)](#faz-3--rapor-motoru-core-engine)
8. [Faz 4 — Görsel Rapor Tasarımcısı](#faz-4--görsel-rapor-tasarımcısı)
9. [Faz 5 — AI Destekli Özellikler](#faz-5--ai-destekli-özellikler)
10. [Faz 6 — Scheduler & Dağıtım](#faz-6--scheduler--dağıtım)
11. [Faz 7 — Mobil Uygulama](#faz-7--mobil-uygulama)
12. [Faz 8 — Test, Dokümantasyon & Deploy](#faz-8--test-dokümantasyon--deploy)
13. [Claude Code ile Çalışma Stratejisi](#claude-code-ile-çalışma-stratejisi)
14. [Marka & İletişim](#marka--iletişim)
15. [Risk & Dikkat Edilecekler](#risk--dikkat-edilecekler)

---

## Proje Özeti

| Özellik | Tutuldu / Yeni / Çıkarıldı |
|---|---|
| Görsel rapor tasarımcısı | ✅ Modern web tabanlı |
| Çoklu veritabanı desteği | ✅ Prisma + native driver'lar |
| Scheduler | ✅ BullMQ ile modern queue |
| Çoklu format export (PDF, Excel, CSV, Word) | ✅ Korundu |
| E-posta/FTP/SSH dağıtım | ✅ Korundu, webhook eklendi |
| **AI destekli SQL/rapor üretimi** | 🆕 Yeni — DataScriba'nın imzası |
| **Mobil uygulama** | 🆕 Yeni — iOS & Android |
| Dashboard & Widget'lar | ❌ Çıkarıldı (MVP dışı) |
| JCR repository | ❌ PostgreSQL'e geçti |
| Jasper Reports uyumluluğu | ❌ Kapsam dışı |

---

## Teknoloji Stack

> Detaylar için `CLAUDE.md` dosyasına bak.

**Özet:**
- **Backend:** NestJS + Prisma + PostgreSQL + Redis + BullMQ
- **Web:** Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- **Mobil:** React Native (Expo SDK 52) + NativeWind
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **Monorepo:** Turborepo + pnpm
- **Container:** Docker + docker-compose

---

## Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────┐
│                    DATASCRIBA İSTEMCİLERİ                    │
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  Web (Next.js)│  │ Mobil (Expo)   │  │   REST API   │  │
│  └───────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
└──────────┼─────────────────────┼──────────────────┼───────┘
           │                     │                  │
           └─────────────────────┴──────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  DataScriba API (NestJS)  │
                    │  (Auth, Rate Limit, RBAC) │
                    └────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼────────┐  ┌────────────▼────────┐  ┌───────────▼──────┐
│ Rapor Modülü   │  │ Veri Kaynağı Modülü │  │  Scriba AI       │
│ - CRUD         │  │ - Bağlantı yönetimi │  │  - NL → SQL      │
│ - Versioning   │  │ - Query executor    │  │  - Şablon önerisi│
│ - Export       │  │ - Driver pool       │  │  - Insight gen.  │
└───────┬────────┘  └─────────────────────┘  └──────────────────┘
        │
┌───────▼────────────┐    ┌────────────────┐
│ Rapor Motoru       │    │ Scheduler      │
│ (Worker Pool)      │◄───┤ (BullMQ)       │
│ - PDF/Excel/Word   │    └────────────────┘
└────────────────────┘
        │
┌───────▼────────────────────────────────┐
│ Dağıtım Modülü                          │
│ - SMTP / FTP / SSH / Webhook / S3      │
└─────────────────────────────────────────┘
```

---

## Faz 0 — Analiz & Hazırlık

**Süre:** 3-5 gün
**Hedef:** NextReports kaynak kodunu analiz, DataScriba'nın temel kararlarını belgele.

### Görevler
- [ ] NextReports GitHub repo'sunu klonla ve incele
- [ ] Mevcut mimari diyagramını çıkar
- [ ] **Korunacak iş mantığı:**
  - Rapor export format mapping
  - Parametre tipleri (date range, multi-select, dependent params)
  - SQL template logic
- [ ] **Atılacak/değiştirilecek:**
  - Apache Wicket UI → React
  - Swing Designer → Web tabanlı drag-drop
  - JCR repository → PostgreSQL
  - Java spesifik bileşenler → TypeScript
- [ ] DataScriba için marka kimliği ön çalışması (logo, renk paleti taslağı)
- [ ] Domain & sosyal hesap rezervasyonu (datascriba.io / .dev / .app)
- [ ] GitHub organization açılışı: `datascriba`

### Çıktılar
- `ANALYSIS.md` — NextReports analizi
- `ARCHITECTURE.md` — DataScriba mimarisi
- `MIGRATION_NOTES.md` — Eski koddan ne alındı/değiştirildi
- Boş monorepo iskeleti
- `BRAND.md` — İsim açıklaması, slogan, renk paleti taslağı

### Claude Code Prompt'u
```
Read CLAUDE.md and ROADMAP.md. We are starting Phase 0 of DataScriba.
First, clone the NextReports repository (github.com/nextreports/nextreports)
and produce ANALYSIS.md with:
1. Module-by-module breakdown
2. Business logic worth preserving in TS rewrite
3. Things to discard
Output as structured markdown. Don't write any code yet.
```

---

## Faz 1 — Temel Altyapı

**Süre:** 1 hafta
**Hedef:** Monorepo, CI/CD, dev ortamı, auth.

### Görevler
- [ ] **Turborepo monorepo** (`pnpm` workspace)
  ```
  apps/
    api/          (NestJS)
    web/          (Next.js)
    mobile/       (Expo) — boş skeleton
    worker/       (BullMQ worker)
  packages/
    shared-types/
    report-engine/
    db-drivers/
    ai-client/
    ui-kit/
  ```
- [ ] PostgreSQL + Redis docker-compose
- [ ] Prisma schema (User, Workspace, DataSource, Report, Schedule, RunHistory, AuditLog)
- [ ] NestJS skeleton:
  - Config module (Zod-validated env)
  - Logger (Pino)
  - Global exception filter
  - Auth modülü (Better-Auth)
  - Health check endpoint
- [ ] Next.js skeleton:
  - App Router + i18n (next-intl)
  - Auth pages (login/register)
  - Layout + theme (light/dark)
  - shadcn/ui kurulumu
- [ ] ESLint + Prettier + Husky + lint-staged
- [ ] GitHub Actions: lint + type-check + test
- [ ] `.env.example` ve config validation

### Çıktılar
- Çalışan login/register akışı
- `pnpm docker:up && pnpm dev` ile tüm sistem ayağa kalkıyor
- CI pipeline yeşil

### Claude Code Prompt Önerisi
```
Phase 1 — Infrastructure. Read CLAUDE.md.
Initialize Turborepo with pnpm workspaces, following the structure in
CLAUDE.md. Start with:
1. Root package.json + turbo.json + pnpm-workspace.yaml
2. apps/api (NestJS bootstrap with health endpoint only)
3. docker-compose for Postgres + Redis
Stop after each step for my review.
```

---

## Faz 2 — Veri Kaynağı Yönetimi

**Süre:** 1-2 hafta
**Hedef:** Kullanıcı DB bağlantısı ekleyip SQL çalıştırabilsin.

### Desteklenecek Veritabanları
- PostgreSQL
- MySQL / MariaDB
- MSSQL
- Oracle
- SQLite
- MongoDB (bonus, MVP sonrası)

### Görevler
- [ ] **Driver abstraction layer**
  ```typescript
  // packages/db-drivers
  interface DataSourceDriver {
    test(): Promise<boolean>
    listTables(): Promise<TableMeta[]>
    describeTable(name: string): Promise<ColumnMeta[]>
    execute(sql: string, params: unknown[]): Promise<QueryResult>
    streamExecute(sql: string, params: unknown[]): AsyncIterable<Row>
    close(): Promise<void>
  }
  ```
- [ ] PostgreSQL driver implementation
- [ ] MySQL driver implementation
- [ ] MSSQL driver implementation
- [ ] Oracle driver (node-oracledb)
- [ ] SQLite driver
- [ ] Connection pool yöneticisi (her DS için ayrı pool)
- [ ] Connection string encryption (AES-256-GCM, master key env'den)
- [ ] Schema introspection (cache'li)
- [ ] Query timeout & cancellation
- [ ] **Frontend:**
  - Bağlantı ekleme formu (her DB tipi için dinamik)
  - Test butonu
  - Şema gezgini (tablo ağacı)
  - Sütun preview

### Güvenlik
- ⚠️ Parameterized queries zorunlu (raw SQL concat yasak)
- ⚠️ Read-only DB user önerisi UI'da göster
- ⚠️ DROP/DELETE/TRUNCATE engelleme opsiyonu

---

## Faz 3 — Rapor Motoru (Core Engine)

**Süre:** 2-3 hafta
**Hedef:** Rapor tanımını alıp çeşitli formatlarda çıktı üretmek.

### Rapor Veri Modeli
```typescript
// packages/shared-types
type ReportDefinition = {
  id: string
  workspaceId: string
  name: string
  description?: string
  dataSourceId: string
  query: string                    // SQL template (Handlebars)
  parameters: ReportParameter[]
  layout: ReportLayout             // tasarım JSON
  exportFormats: ExportFormat[]    // ['pdf', 'xlsx', 'csv', 'docx']
  version: number
  createdBy: string
  updatedAt: Date
}

type ReportParameter = {
  name: string
  type: 'string' | 'number' | 'date' | 'dateRange' | 'select' | 'multiSelect' | 'boolean'
  required: boolean
  defaultValue?: unknown
  options?: { sourceQuery?: string; static?: unknown[] }
  dependsOn?: string[]
}
```

### Export Pipeline
```
Report Definition → Query Builder → Execute → Transform → Renderer → File
                                                              ↓
                                              PDF / Excel / Word / CSV / HTML
```

### Görevler
- [ ] Query template engine (Handlebars + custom helpers)
- [ ] Parametre validation (Zod, runtime + compile-time)
- [ ] **Renderer'lar** (`packages/report-engine`):
  - PDF (Puppeteer + HTML template)
  - Excel (ExcelJS, stiller + formüller)
  - Word (docx kütüphanesi)
  - CSV/TSV (streaming için papaparse)
  - HTML (server-side React render)
- [ ] **Worker pool** (`apps/worker`, BullMQ)
- [ ] Run history (DB kayıtları)
- [ ] Report versioning (her save = yeni version)
- [ ] File storage (local FS başta, S3 ileride)
- [ ] Progress reporting (websocket veya polling)

### Claude Code Prompt Önerisi
```
Phase 3 — Report Engine.
Create packages/report-engine. Start with the renderer interface, then
implement the CSV renderer first (simplest, streaming). Write unit tests
for each renderer using sample fixture data. Then PDF (Puppeteer), then
Excel (ExcelJS). One renderer at a time, review between each.
```

---

## Faz 4 — Görsel Rapor Tasarımcısı

**Süre:** 3-4 hafta — *en kritik faz*
**Hedef:** Drag-drop ile rapor tasarımı.

### Editör Bölümleri
1. **Sol panel:** Veri kaynağı + tablo/sütun ağacı + parametre listesi
2. **Orta canvas:** Sürükle-bırak tasarım alanı
3. **Sağ panel:** Seçili öğenin özellikleri (dinamik form)
4. **Üst toolbar:** Önizleme, kaydet, yayınla, parametre editörü, AI asistan butonu

### Bileşenler
- Tablo (data grid)
- Başlık / Footer
- Metin bloğu (Markdown destekli)
- Resim
- Grafik (bar, line, pie, area)
- Sayfa kesimi
- Toplam / subtotal satırları
- Conditional formatting

### Teknik Yaklaşım
- **@dnd-kit/core** sürükle-bırak için
- **React Hook Form** özellik panelleri için
- **Zustand + zundo** editör state'i (undo/redo)
- Her bileşen → JSON schema serialize
- Önizleme = aynı JSON'ı backend render'a yolla

### Görevler
- [ ] Canvas + grid sistemi
- [ ] Bileşen kütüphanesi
- [ ] Dinamik özellik paneli (form generator)
- [ ] Undo/Redo
- [ ] Parametre tanımlama UI
- [ ] Canlı önizleme (debounced)
- [ ] SQL editor (Monaco + syntax highlight + autocomplete)
- [ ] Otomatik kaydetme
- [ ] Layout JSON validation (Zod)
- [ ] **AI asistan butonu** (Faz 5 entegrasyonu için hook)

---

## Faz 5 — AI Destekli Özellikler (Scriba AI)

**Süre:** 2 hafta
**Hedef:** DataScriba'nın imzası — AI yardımcı "Scriba".

### Özellikler

#### 1. Doğal Dilden SQL (NL → SQL)
> Kullanıcı: *"Son 30 günde en çok satılan 10 ürünü göster"*
> Scriba: Schema'yı context olarak verir → SQL üretir → kullanıcı onaylar → çalıştırır

```typescript
// packages/ai-client/src/sql-generator.ts
async function generateSQL(
  prompt: string,
  dataSourceId: string,
  userId: string
): Promise<{ sql: string; explanation: string }> {
  const schema = await schemaIntrospector.get(dataSourceId)
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SQL_GENERATOR_PROMPT,
    messages: [{
      role: 'user',
      content: `Schema:\n${schema}\n\nRequest: ${prompt}`
    }]
  })
  return validateAndParse(response)
}
```

#### 2. Rapor Şablonu Önerisi
- Schema analizi → yaygın rapor önerileri ("Aylık satış", "Top müşteriler")
- One-click şablon kurulumu

#### 3. Veri Insight Üretimi
- Rapor çıktısı → doğal dilde özet
- Anomali tespiti
- PDF kapağına otomatik insight

#### 4. SQL Hata Açıklama
- Hata mesajı → anlaşılır açıklama + öneri

#### 5. Akıllı Parametre Önerisi
- SQL analizi → parametre eklenebilecek yerleri öner

### Prompt Yönetimi
- Tüm prompt'lar `packages/ai-client/prompts/` altında dosya olarak
- Versiyonlama: `sql-generator.v1.txt`, `v2.txt` vb.
- A/B test için prompt registry

### Güvenlik
- ⚠️ AI'ın ürettiği SQL **asla** otomatik çalıştırılmaz, önce kullanıcı onaylar
- ⚠️ Read-only validation (UPDATE/DELETE/DROP engelle)
- ⚠️ Rate limiting (kullanıcı başına token quota)
- ⚠️ Veri kaynağındaki **gerçek veri AI'a gönderilmez**, sadece schema
- ⚠️ AI çıktısı Zod ile validate
- ⚠️ Kullanıcı tercihi: AI özelliği opt-in

### Görevler
- [ ] `packages/ai-client` modülü (Claude SDK wrapper)
- [ ] Prompt template sistemi
- [ ] SQL generator + validator
- [ ] Schema introspection cache (Redis)
- [ ] Token usage tracking (DB)
- [ ] Rate limiter
- [ ] Frontend AI chat UI (Scriba assistant panel)
- [ ] User feedback toplama (thumbs up/down, future fine-tune için)

---

## Faz 6 — Scheduler & Dağıtım

**Süre:** 1-2 hafta
**Hedef:** Raporları belirli zamanlarda çalıştır ve dağıt.

### Görevler
- [ ] BullMQ cron job sistemi
- [ ] Schedule UI (cron expression builder + preset'ler: daily/weekly/monthly)
- [ ] **Dağıtım kanalları:**
  - SMTP (Nodemailer)
  - FTP/SFTP (basic-ftp / ssh2-sftp-client)
  - SSH (rsync benzeri, ssh2 ile)
  - S3 / Azure Blob / GCS (opsiyonel)
  - Webhook (POST JSON)
  - WebDAV
- [ ] Retry policy + dead letter queue
- [ ] Notification: başarı/başarısızlık e-postaları
- [ ] Run history (filtrelenebilir log)
- [ ] Manuel "Şimdi çalıştır" butonu
- [ ] **Mobil için push notification hook'u** (Faz 7'de kullanılacak)

---

## Faz 7 — Mobil Uygulama

**Süre:** 2-3 hafta
**Hedef:** iOS/Android için rapor görüntüleme ve tetikleme.

### MVP Özellikler
- [ ] Login (biometric desteği: FaceID/TouchID/Android Biometric)
- [ ] Rapor listesi
- [ ] Rapor parametre formu + çalıştırma
- [ ] PDF önizleme (`react-native-pdf`)
- [ ] Push notification (rapor hazır olduğunda)
- [ ] Offline cache (son çalıştırılan raporlar — MMKV)
- [ ] **Scriba AI chat** (doğal dil ile rapor çalıştırma — mobilin yıldız özelliği)
- [ ] Dark mode

### Görevler
- [ ] Expo SDK 52 projesi (`apps/mobile`)
- [ ] Auth flow (Expo SecureStore + biometric)
- [ ] API client (TanStack Query, web ile paylaşımlı)
- [ ] Push notifications (Expo Notifications + backend FCM/APNs)
- [ ] PDF viewer
- [ ] iOS & Android build pipeline (EAS Build)
- [ ] App Store + Play Store hazırlığı (screenshot, açıklama, icon)

---

## Faz 8 — Test, Dokümantasyon & Deploy

**Süre:** 1-2 hafta

### Test
- [ ] Unit tests (Vitest) — %80+ coverage
- [ ] Integration tests (Supertest)
- [ ] E2E tests (Playwright) — kritik akışlar
- [ ] Mobile E2E (Maestro veya Detox)
- [ ] Load test (k6) — rapor motoru
- [ ] AI prompt regression tests

### Dokümantasyon
- [ ] API docs (Swagger auto-generated, `/api/docs`)
- [ ] Kullanıcı kılavuzu (Mintlify veya VitePress)
- [ ] Geliştirici kılavuzu (CONTRIBUTING.md)
- [ ] AI özellik kılavuzu (Scriba AI nasıl kullanılır)
- [ ] Video tutorial'lar (Loom kayıtları — opsiyonel)
- [ ] Landing page (datascriba.io)

### Deploy
- [ ] Docker images (multi-stage build, alpine)
- [ ] `docker-compose.prod.yml`
- [ ] Kubernetes manifest'leri (opsiyonel, Helm chart)
- [ ] Database migration stratejisi
- [ ] Backup & restore script'leri
- [ ] Monitoring (OpenTelemetry + Grafana / Sentry)
- [ ] Release process (GitHub Releases, changelog auto-gen)

---

## Claude Code ile Çalışma Stratejisi

### 🎯 Genel Prensipler

1. **CLAUDE.md her zaman güncel** — her oturum öncesi okunur
2. **Modüler prompt'lar** — bir seferde bir modül
3. **Spec-first** — önce TS interface ve Zod schema, sonra implementation
4. **Test-driven** — önce test, sonra kod
5. **Faz başına branch** — `feature/phase-X-name`
6. **PROGRESS.md** — her faz için ilerleme dosyası

### 📝 Önerilen Workflow

**1. Faz başlangıcı:**
```
Read CLAUDE.md and ROADMAP.md. We are starting Phase X.
List all tasks, propose an order, and wait for my confirmation.
Create apps/PHASE_X_PROGRESS.md to track progress.
```

**2. Modül implementasyonu:**
```
Implement the [module name] module:
1. Define types in packages/shared-types
2. Create Prisma schema additions (if needed)
3. Build NestJS module skeleton (controller + service + repository)
4. Implement core logic
5. Write unit tests
6. Update PHASE_X_PROGRESS.md
Stop after each step for my review.
```

**3. Code review:**
```
Review the code you just wrote against CLAUDE.md guidelines:
- Type safety (no `any`)
- Error handling
- Security (SQL injection, secret leakage)
- Test coverage
- Naming conventions
Suggest improvements before commit.
```

**4. Commit:**
```
Create a conventional commit for the changes. Use the format:
<type>(<scope>): <description>

Types: feat, fix, chore, docs, test, refactor, perf
```

### 🛠️ Komut Referansı

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "db:migrate": "pnpm --filter=api prisma migrate dev",
    "db:studio": "pnpm --filter=api prisma studio",
    "db:seed": "pnpm --filter=api prisma db seed",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "claude:context": "cat CLAUDE.md ROADMAP.md PHASE_*.md 2>/dev/null"
  }
}
```

---

## Marka & İletişim

### İsim
**DataScriba** — Latince "scriba" (yazıcı/kâtip) + "data"

### Slogan Adayları
- *Your AI-powered data scribe*
- *Reports, written by Scriba*
- *Where data meets clarity*
- *The intelligent scribe for your data*

### Logo Konsepti (Taslak)
- Tüy kalemi (quill) + veri noktası kombinasyonu
- Modern minimal, monokrom + accent renk
- Sembol olarak da kullanılabilir (favicon, app icon)

### Renk Paleti (Taslak)
- **Primary:** Slate-900 (#0F172A) — derinlik, profesyonellik
- **Accent:** Indigo-500 (#6366F1) — modern, teknolojik
- **AI Accent:** Violet-500 (#8B5CF6) — Scriba AI vurgusu
- **Success:** Emerald-500
- **Warning:** Amber-500
- **Error:** Rose-500

### Tone of Voice
- Profesyonel ama yaklaşılabilir
- Teknik ama jargonsuz
- AI özelliklerinde "büyü" değil, "yardımcı" hissi
- Scriba bir karakter — kullanıcının veri kâtibi

### Sosyal & Web
- **Domain rezerve et:** datascriba.io, datascriba.dev, datascriba.app
- **GitHub org:** github.com/datascriba
- **Twitter/X:** @datascriba (kontrol et)
- **Discord:** Topluluk için (sonra)

---

## Risk & Dikkat Edilecekler

### ⚠️ Teknik Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Oracle driver lisans | Yüksek | node-oracledb resmi, dokümante et |
| Puppeteer Docker kaynak tüketimi | Orta | Headless Chrome image, memory limit, queue throttling |
| Büyük raporlarda OOM | Yüksek | Streaming export, pagination zorunlu |
| AI maliyeti kontrolsüz | Orta | Token quota per user, response caching |
| Schema introspection performansı | Orta | Redis cache + manuel refresh |
| Mobil push notification kurulumu | Orta | FCM (Android) + APNs (iOS) ayrı kurulum |

### 🔒 Güvenlik Kontrol Listesi
- [ ] SQL injection (parameterized queries)
- [ ] Connection string encryption (AES-256-GCM)
- [ ] RBAC (workspace bazlı izolasyon)
- [ ] Rate limiting (API + AI ayrı)
- [ ] Audit log (kim ne zaman ne çalıştırdı)
- [ ] Secret rotation policy
- [ ] CSP headers (XSS)
- [ ] CSRF tokens
- [ ] AI input sanitization
- [ ] OWASP Top 10 review (Faz 8'de pen-test)

### 📊 Tahmini Toplam Süre
- **MVP (Faz 0-6):** ~12-14 hafta
- **Mobil + Polish (Faz 7-8):** ~3-5 hafta
- **Toplam:** ~4 ay (tek geliştirici, full-time)
- **Claude Code ile:** ~%40-60 hızlanma beklenir

---

## 🎬 Hemen Başlamak İçin

1. ✅ `CLAUDE.md` ve `ROADMAP.md`'yi yeni boş repo'ya ekle
2. ✅ Domain ve GitHub org rezerve et
3. ✅ İlk Claude Code prompt'u:
   > *"Read ROADMAP.md and CLAUDE.md. Let's start Phase 0. First, analyze the original NextReports repository and produce ANALYSIS.md. Don't write any code yet — just analysis."*

---

**🎯 DataScriba, modern raporlamayı yeniden tanımlamak için yola çıktı.**
*Bu doküman yaşayan bir belgedir, projeniz ilerledikçe güncellenmelidir.*
