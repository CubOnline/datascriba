# DataScriba

> Your AI-powered data scribe

DataScriba is a modern, open-source reporting platform with AI-assisted SQL generation,
scheduling, and multi-format export. Inspired by NextReports, built from scratch in TypeScript.

## Features

- **Data Source Management** — Connect to MSSQL databases with encrypted credentials (AES-256-GCM)
- **Report Builder** — SQL-based report definitions with typed parameters (string, number, date, dateRange, select, multiSelect, boolean)
- **Export Formats** — CSV and Excel (.xlsx) with styled headers and frozen panes
- **Scheduler** — Cron-based report scheduling with BullMQ queue dispatch
- **Scriba AI** — Natural language to SQL, query explanation (TR/EN), and query fixing via Anthropic Claude (streaming SSE)
- **REST API** — NestJS 10 API with Swagger UI at `/api/docs`
- **Worker** — Separate BullMQ worker process for async report execution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, TypeScript 5.5+ |
| Queue | BullMQ + Redis 7 |
| Database | PostgreSQL 16 (Prisma) |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Frontend | Next.js 15, React 19, TailwindCSS 4 |
| Export | ExcelJS, PapaParse |

## Quickstart

### Prerequisites

- Docker and Docker Compose v2
- Node.js 22 LTS
- pnpm 9+

### 1. Clone and Install

```bash
git clone https://github.com/your-org/datascriba.git
cd datascriba
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — at minimum set ENCRYPTION_MASTER_KEY and ANTHROPIC_API_KEY
# Generate ENCRYPTION_MASTER_KEY: openssl rand -hex 32
```

### 3. Start Infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

Starts PostgreSQL 16, Redis 7, API (port 3001), and Worker.

### 4. Open

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/health |

### Local Development (without Docker API/Worker)

```bash
# Infrastructure only
docker compose -f docker/docker-compose.yml up postgres redis -d

# In separate terminals:
pnpm --filter=api dev
pnpm --filter=worker dev
pnpm --filter=web dev
```

## Screenshots

<!-- Screenshots will be added after UI stabilization -->
_Coming soon._

## Development Commands

```bash
pnpm test              # Run all tests
pnpm test:coverage     # Coverage report (target: 80%+)
pnpm lint              # ESLint check
pnpm type-check        # TypeScript strict check
pnpm db:migrate        # Run Prisma migrations
pnpm db:studio         # Open Prisma Studio
```

## Project Structure

```
datascriba/
├── apps/
│   ├── api/        # NestJS REST API
│   ├── web/        # Next.js 15 frontend
│   └── worker/     # BullMQ job processor
├── packages/
│   ├── shared-types/    # Shared TypeScript types
│   ├── report-engine/   # CSV/Excel rendering + parameter validation
│   ├── db-drivers/      # MSSQL driver + crypto + query guard
│   ├── ai-client/       # Anthropic SDK wrapper
│   └── queue-config/    # BullMQ job schemas
├── docker/
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── deployment.md
│   └── adr/
└── .github/workflows/
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, agent workflow, and PR rules.

## License

Apache 2.0
