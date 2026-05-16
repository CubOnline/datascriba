# DataScriba — System Architecture

## Overview

DataScriba follows a monorepo structure (Turborepo + pnpm workspaces) with three deployable
applications and five shared packages.

## System Diagram

```mermaid
graph TB
    subgraph Client
        WEB["Next.js 15\napps/web\n:3000"]
    end

    subgraph API
        NEST["NestJS 10\napps/api\n:3001"]
    end

    subgraph Workers
        WORKER["BullMQ Worker\napps/worker"]
    end

    subgraph Queue
        REDIS[("Redis 7\nBullMQ")]
    end

    subgraph Storage
        PG[("PostgreSQL 16\nPrisma ORM")]
        FS["FileSystem\n./output/"]
    end

    subgraph External
        ANTHROPIC["Anthropic API\nclaude-sonnet-4-6"]
        MSSQL[("MSSQL Server\ncustomer DB")]
    end

    WEB -->|"REST + SSE"| NEST
    NEST -->|"enqueue job"| REDIS
    NEST -->|"CRUD"| PG
    NEST -->|"AES-256-GCM conn strings"| MSSQL
    NEST -->|"streaming"| ANTHROPIC
    WORKER -->|"dequeue"| REDIS
    WORKER -->|"execute query"| MSSQL
    WORKER -->|"write CSV/XLSX"| FS
```

## Package Dependency Graph

```mermaid
graph LR
    API["apps/api"] --> ST["shared-types"]
    API --> RE["report-engine"]
    API --> DB["db-drivers"]
    API --> AI["ai-client"]
    API --> QC["queue-config"]

    WORKER["apps/worker"] --> ST
    WORKER --> RE
    WORKER --> DB
    WORKER --> QC

    WEB["apps/web"] --> ST

    RE --> ST
    DB --> ST
    AI --> ST
    QC --> ST
```

## Data Flow — Synchronous Report Execution

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant DS as DataSourceService
    participant RE as report-engine
    participant DB as MSSQL

    C->>A: POST /reports/:id/run {format, parameters}
    A->>A: validateParameters()
    A->>A: renderTemplate(sql, params)
    A->>DS: executeQuery(dataSourceId, sql, [])
    DS->>DB: parameterized query
    DB-->>DS: ResultSet
    DS-->>A: QueryResult {columns, rows}
    A->>RE: renderReport(data, {format})
    RE-->>A: Buffer (CSV or XLSX)
    A->>A: writeFileSync(outputPath, buffer)
    A-->>C: 200 + Buffer + Content-Disposition
```

## Data Flow — Scheduled Report (Async)

```mermaid
sequenceDiagram
    participant CRON as NestJS Cron
    participant SCHED as ScheduleService
    participant Q as BullMQ
    participant W as Worker
    participant DB as MSSQL
    participant FS as FileSystem

    CRON->>SCHED: dispatchDueSchedules() every minute
    SCHED->>SCHED: find enabled where nextRunAt <= now
    SCHED->>Q: queue.add('run-report', payload)
    SCHED->>SCHED: update nextRunAt
    Q->>W: job dequeued
    W->>DB: execute query
    DB-->>W: rows
    W->>FS: write CSV/XLSX
```

## Data Flow — AI SQL Suggestion (Streaming SSE)

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant DS as DataSourceService
    participant ANT as Anthropic API

    C->>A: POST /ai/suggest-query {prompt, dataSourceId}
    A->>DS: listTables() + describeTable()
    DS-->>A: SchemaContext
    A->>ANT: messages.stream() with schema context
    ANT-->>A: streaming chunks
    A-->>C: SSE data: {"type":"delta","text":"..."}
    A-->>C: SSE data: {"type":"done"}
```

## Security Model

| Concern | Mechanism |
|---------|-----------|
| Connection string storage | AES-256-GCM, key from `ENCRYPTION_MASTER_KEY` env |
| Mutation prevention | `assertQueryAllowed()` blocks DROP/DELETE/TRUNCATE |
| SQL injection | Parameterized queries at driver level |
| AI rate limiting | ThrottlerModule (configurable RPM per IP) |
| Response sanitization | `encryptedConnectionString` always redacted in API responses |

## NestJS Module Structure

```
src/
├── modules/
│   ├── data-source/    CRUD + connection management
│   ├── report/         CRUD + synchronous run
│   ├── schedule/       CRUD + cron dispatch + manual trigger
│   └── ai/             SSE streaming + explain endpoint
├── health/             GET /health
├── common/filters/     AppExceptionFilter (global)
└── config/env.ts       Zod-validated environment
```
