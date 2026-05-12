# CLAUDE.md — DataScriba Project Context

> **Bu dosya Claude Code (ve subagent'ler) için proje rehberidir.**
> Her oturum başlangıcında otomatik okunur. Tüm ajanlar bu kuralları izler.
> Güncel tut!

---

## 🎯 Proje Kimliği

- **İsim:** DataScriba
- **Slogan:** *Your AI-powered data scribe*
- **Köken:** "Scriba" Latince "yazıcı/kâtip" anlamına gelir
- **Misyon:** Modern, AI destekli, mobil uyumlu açık kaynak raporlama platformu
- **İlham:** NextReports (Java tabanlı). Mimarisinden esinleniyoruz, sıfırdan TS ile yazıyoruz
- **Lisans:** Apache 2.0

---

## 🤖 Multi-Agent Workflow

Bu proje **4 specialized subagent** ile geliştirilir:

| Ajan | Rol | Ne Zaman Çağrılır |
|------|-----|-------------------|
| 🧠 **planner** | Analiz, görev bölme, plan üretimi | Her yeni özellik/faz başlangıcı |
| 🔨 **builder** | TypeScript kod yazımı | Plan onaylandıktan sonra |
| 🔍 **reviewer** | Kalite + güvenlik denetimi | Builder her checkpoint sonrası |
| 🧪 **tester** | Test yazımı + çalıştırma | Reviewer onayından sonra |

**Akış:** `planner → [user gate] → builder → reviewer → tester → done`

Detaylı workflow ve handoff protokolü için: **`.claude/AGENT_WORKFLOW.md`** dosyasına bakın.

### Hangi Ajan Hangi Dosyayı Üretir?

| Dosya | Üreten | Okuyan |
|-------|--------|--------|
| `TASK_PLAN.md` | planner | builder, reviewer, tester |
| `PHASE_X_PROGRESS.md` | builder günceller | tüm ajanlar |
| `REVIEW.md` | reviewer | builder (red ise), tester |
| `TEST_REPORT.md` | tester | kullanıcı |
| Kaynak kod (`*.ts`, `*.tsx`) | builder | reviewer (okur), tester (test ekler) |
| Testler (`*.spec.ts`) | builder + tester | reviewer |

---

## 🛠️ Teknoloji Stack

### Backend
- **Runtime:** Node.js 22 LTS
- **Framework:** NestJS 10
- **Dil:** TypeScript 5.5+ (strict mode)
- **ORM:** Prisma 6
- **Veritabanı:** PostgreSQL 16
- **Queue:** BullMQ + Redis 7
- **Auth:** Better-Auth
- **Validation:** Zod
- **Logging:** Pino
- **API Docs:** Swagger/OpenAPI

### Frontend (Web)
- **Framework:** Next.js 15 (App Router)
- **UI:** React 19 + TailwindCSS 4 + shadcn/ui
- **State:** Zustand (client) + TanStack Query v5 (server)
- **Forms:** React Hook Form + Zod resolver
- **Drag-Drop:** @dnd-kit/core
- **Charts:** Recharts / Apache ECharts
- **Code Editor:** Monaco Editor

### Mobil
- **Framework:** React Native + Expo SDK 52
- **Navigation:** Expo Router
- **UI:** NativeWind + react-native-paper

### Rapor Motoru
- **PDF:** Puppeteer
- **Excel:** ExcelJS
- **Word:** docx
- **CSV:** papaparse

### AI
- **Provider:** Anthropic Claude
- **Model:** `claude-sonnet-4-6`
- **SDK:** @anthropic-ai/sdk

### DevOps
- **Container:** Docker + docker-compose
- **CI/CD:** GitHub Actions
- **Monorepo:** Turborepo + pnpm 9+

---

## 📁 Proje Yapısı

```
datascriba/
├── .claude/
│   ├── agents/
│   │   ├── planner.md
│   │   ├── builder.md
│   │   ├── reviewer.md
│   │   └── tester.md
│   ├── AGENT_WORKFLOW.md
│   └── agent-memory/        # Otomatik oluşur (gitignore'd from sensitive)
├── apps/
│   ├── api/                 # NestJS backend
│   ├── web/                 # Next.js web
│   ├── mobile/              # Expo mobile
│   └── worker/              # BullMQ workers
├── packages/
│   ├── shared-types/
│   ├── report-engine/
│   ├── db-drivers/
│   ├── ai-client/
│   └── ui-kit/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── adr/                 # Architecture Decision Records
├── docker/
├── .github/workflows/
├── CLAUDE.md                # ← Bu dosya
├── ROADMAP.md
├── README.md
├── TASK_PLAN.md             # Aktif görev planı (planner üretir)
├── REVIEW.md                # Son review (reviewer üretir)
├── TEST_REPORT.md           # Son test sonucu (tester üretir)
└── package.json
```

---

## 🧭 Kod Standartları (Tüm Ajanlar İçin)

### TypeScript
1. **Strict mode** her zaman açık
2. **`any` yasak** — `unknown` + type guard kullan
3. **Explicit return types** export edilen fonksiyonlarda
4. **`interface`** object şekilleri için, **`type`** union/intersection için
5. **`satisfies` operator** inferred types için

### Naming
| Tip | Format | Örnek |
|-----|--------|-------|
| Dosya | `kebab-case` | `data-source.service.ts` |
| Class/Type/Interface | `PascalCase` | `DataSourceService` |
| Function/variable | `camelCase` | `createDataSource` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_QUERY_TIMEOUT` |
| Prefix yok | `IFoo`, `TFoo` ❌ | `Foo` ✅ |

### Validation
- Tüm external input → **Zod schema**
- API DTO'lar → class-validator veya Zod
- Environment variables → `config/env.ts` içinde Zod

### Error Handling
- Custom `AppError` base class
- Global NestJS exception filter
- Async fonksiyonlar try-catch'li
- **Hata yutma yasak** — log ve re-throw

### Logging
- **Pino** kullan (NestJS Pino module)
- **`console.log` yasak** (production'da)
- Structured: `logger.info({ userId, action }, 'msg')`

### Güvenlik
- Parameterized queries (Prisma + `$queryRaw` template literal)
- Connection strings AES-256-GCM ile encrypt
- Secrets asla log'da
- AI-generated SQL validate edilmeden çalıştırılmaz
- Rate limit AI endpoint'lerinde

### Module Yapısı (NestJS)
```
apps/api/src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts      # Prisma calls ONLY here
├── dto/
└── <feature>.service.spec.ts
```

### React (Web/Mobile)
- Server components default, `'use client'` sadece gerektiğinde
- Named exports (Next.js pages hariç)
- shadcn/ui from `packages/ui-kit`
- Tailwind classes, no inline styles

---

## 🧪 Test Stratejisi

| Tip | Tool | Hedef |
|-----|------|-------|
| Unit | Vitest | %80+ coverage |
| Integration | Supertest | API endpoint'leri |
| E2E (web) | Playwright | Kritik flow'lar |
| E2E (mobile) | Maestro | Login, rapor görüntüleme |
| Load | k6 | Rapor motoru |

**Her PR test gerektirir.** Reviewer test eksikse reddeder. Tester ek test ekleyebilir.

---

## 🎨 UI/UX Prensipleri

- **Tasarım dili:** Modern, minimal (Linear + Vercel esinli)
- **Renk paleti:**
  - Primary: Slate-900 (#0F172A)
  - Accent: Indigo-500 (#6366F1)
  - AI Accent: Violet-500 (#8B5CF6)
- **Tipografi:** Inter (UI) + JetBrains Mono (code)
- **Dark mode:** Zorunlu
- **Erişilebilirlik:** WCAG 2.1 AA
- **Diller:** İngilizce + Türkçe (next-intl)

---

## 🚀 Mevcut Durum

- **Faz:** 0 — Analiz & Hazırlık
- **Sprint:** Henüz başlamadı
- **Aktif ajan:** Yok (kullanıcı planner ile başlamalı)
- **Son güncelleme:** [TARİH GİR]

### Faz Durumları
- [ ] Faz 0 — Analiz & Hazırlık
- [ ] Faz 1 — Temel Altyapı
- [ ] Faz 2 — Veri Kaynağı Yönetimi
- [ ] Faz 3 — Rapor Motoru
- [ ] Faz 4 — Görsel Rapor Tasarımcısı
- [ ] Faz 5 — AI Destekli Özellikler (Scriba AI)
- [ ] Faz 6 — Scheduler & Dağıtım
- [ ] Faz 7 — Mobil Uygulama
- [ ] Faz 8 — Test, Doküman & Deploy

---

## 🚦 Soru/Onay Gerektiren Durumlar

Tüm ajanlar şu durumlarda devam etmeden önce kullanıcıya sormalı:

1. **Yeni dependency** (özellikle ağır olanlar)
2. **Mimari karar değişikliği** (yeni katman, yeni service)
3. **Breaking change** (API, DB schema, type)
4. **Güvenlik etkili** kararlar
5. **AI prompt değişiklikleri**
6. **3'ten fazla dosya etkileyen refactor**
7. **CLAUDE.md veya ROADMAP.md** dışındaki guideline değişiklikleri

---

## 📚 Önemli Dosyalar (Tüm Ajanlar Okur)

1. **`CLAUDE.md`** — Bu dosya (proje rehberi)
2. **`ROADMAP.md`** — Faz planı
3. **`.claude/AGENT_WORKFLOW.md`** — Ajanlar arası akış
4. **`TASK_PLAN.md`** — Aktif görev (varsa)
5. **`PHASE_X_PROGRESS.md`** — Aktif fazın ilerleme durumu
6. **`docs/adr/*.md`** — Mimari karar kayıtları

---

## 🛠️ Komut Reference

```bash
# Geliştirme
pnpm dev                    # Tüm uygulamalar
pnpm dev --filter=api
pnpm dev --filter=web

# Test
pnpm test
pnpm test:watch
pnpm test:coverage
pnpm test:e2e

# Kalite
pnpm lint
pnpm format
pnpm type-check

# Veritabanı
pnpm db:migrate
pnpm db:studio
pnpm db:seed

# Docker
pnpm docker:up
pnpm docker:down

# Ajanlar
claude /agents              # Ajanları yönet (Claude Code içinde)
claude --agent planner      # Sadece planner ile session başlat
```

---

## 💡 Ajan Çağırma Hızlı Referans

```bash
# Natural language
"Use the planner agent to plan Phase 2"
"Have the reviewer look at my recent changes"

# @-mention (garantili)
@planner plan the PostgreSQL driver
@builder implement TASK_PLAN.md
@reviewer review the latest commit
@tester verify coverage on db-drivers
```

---

## ❌ Yapma Listesi (Tüm Ajanlar İçin)

- ❌ `console.log` (Pino kullan)
- ❌ `any` tipi
- ❌ Inline SQL string concatenation
- ❌ Hardcoded secrets
- ❌ Default export (Next.js pages hariç)
- ❌ `var` (let/const)
- ❌ `==` (her zaman `===`)
- ❌ Awaitless Promise
- ❌ Test'siz feature merge
- ❌ NextReports Java kodu kopyala (mimarisinden esinlen, fresh TS yaz)
- ❌ CLAUDE.md veya ROADMAP.md'yi user onayı olmadan değiştir

## ✅ Yap Listesi

- ✅ Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- ✅ Her PR'da test
- ✅ Breaking change → `BREAKING:` etiketi
- ✅ Public API'lere JSDoc
- ✅ Karmaşık logic → ADR (`docs/adr/`)
- ✅ AI prompt'ları → `packages/ai-client/prompts/`
- ✅ Workflow'a uy: planner → builder → reviewer → tester
- ✅ Her ajan kendi MEMORY.md'sini günceller

---

## 🔗 Faydalı Linkler

- [NextReports GitHub](https://github.com/nextreports/nextreports)
- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Expo Docs](https://docs.expo.dev/)
- [Anthropic API](https://docs.claude.com/)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Turborepo Docs](https://turborepo.com/docs)

---

**Son söz:** DataScriba'yı modern, güvenli, kullanıcı dostu yapmak için **disiplinli bir pipeline** kurduk. 4 ajan, 4 dosya, 4 gate. Yavaşlatmak değil — kalitede kalmak için. 🎯
