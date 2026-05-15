# TASK_PLAN.md — Phase 5: Scriba AI

**Agent:** builder
**Phase:** 5
**Planner:** planner (claude-sonnet-4-6)
**Tarih:** 2026-05-15
**Bağımlı Fazlar:** Faz 2 (DataSource + db-drivers), Faz 3 (ReportModule)

---

## Genel Bakış

Faz 5, DataScriba'ya Anthropic Claude tabanlı AI yardımcısı ekler. Kullanıcılar rapor editöründe doğal dil ile SQL önerisi alabilir, mevcut SQL'i açıklayabilir ve hatalı SQL'i düzeltebilir.

### Mimari Kararlar

- **packages/ai-client/**: Anthropic SDK wrapper paketi — API'den bağımsız, test edilebilir
- **AI modülü NestJS'e entegre**: `AiModule` → `AppModule`'e import edilir
- **Streaming**: NestJS `@Sse()` decorator + Fastify SSE — her chunk `data:` satırı olarak gönderilir
- **Rate limiting**: `@nestjs/throttler` global + AI endpoint'lerine özel TTL
- **Prompt caching**: Sistem promptu `cache_control: { type: 'ephemeral' }` ile cache'lenir
- **Şema**: MSSQL `INFORMATION_SCHEMA` — `DataSourceService.listTables()` + `describeTable()` reuse
- **Frontend panel**: Collapsible sidebar — `RadixUI` `@radix-ui/react-collapsible` + Tabs

---

## Bağımlılık Grafiği

```
STEP-01: packages/ai-client paket iskeleti
    ↓
STEP-02: packages/ai-client/src/types.ts
    ↓
STEP-03: packages/ai-client/src/prompts/*.ts
    ↓
STEP-04: packages/ai-client/src/client.ts (Anthropic wrapper)
    ↓
STEP-05: packages/ai-client/src/index.ts (exports)
    ↓
STEP-06: packages/shared-types/src/ai.ts (AI tipleri)
    ↓
STEP-07: apps/api — @nestjs/throttler bağımlılığı + env.ts güncelleme
    ↓
STEP-08: apps/api/src/modules/ai/dto/*.ts
    ↓
STEP-09: apps/api/src/modules/ai/ai.service.ts
    ↓
STEP-10: apps/api/src/modules/ai/ai.controller.ts
    ↓
STEP-11: apps/api/src/modules/ai/ai.module.ts
    ↓
STEP-12: apps/api/src/app.module.ts güncellemesi (ThrottlerModule + AiModule)
    ↓
STEP-13: apps/api/src/common/filters/app-exception.filter.ts güncellemesi
    ↓
STEP-14: apps/web — @radix-ui/react-collapsible bağımlılığı
    ↓
STEP-15: apps/web/src/hooks/use-ai.ts
    ↓
STEP-16: apps/web/src/components/ui/collapsible.tsx
    ↓
STEP-17: apps/web/src/components/ui/tabs.tsx (shadcn wrapper)
    ↓
STEP-18: apps/web/src/components/ai/ai-assistant-panel.tsx
    ↓
STEP-19: apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx güncellemesi
    ↓
STEP-20: i18n mesaj dosyaları güncelleme (en.json + tr.json)
    ↓
STEP-21: packages/shared-types/src/index.ts güncelleme
    ↓
STEP-22: apps/api/src/modules/ai/ai.service.spec.ts (birim test)
    ↓
STEP-23: .env.example güncelleme
```

---

## Görevler

### STEP-01: packages/ai-client — Paket İskeleti

**Oluşturulacak dosyalar:**
- `packages/ai-client/package.json`
- `packages/ai-client/tsconfig.json`

**Bağımlılıklar:** Yok (ilk adım)

**packages/ai-client/package.json:**

```json
{
  "name": "@datascriba/ai-client",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@datascriba/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@datascriba/eslint-config": "workspace:*",
    "@datascriba/tsconfig": "workspace:*",
    "@swc/core": "^1.15.33",
    "@types/node": "^22.10.7",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

**packages/ai-client/tsconfig.json:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Not:** `pnpm install` sonrası `@anthropic-ai/sdk` paketi `node_modules` altına gelir. Turborepo bu paketi otomatik tanır çünkü `pnpm-workspace.yaml` `packages/*` pattern'ini içerir.

---

### STEP-02: packages/ai-client/src/types.ts

**Oluşturulacak dosya:** `packages/ai-client/src/types.ts`

**Bağımlılıklar:** STEP-01

```typescript
import type { ColumnMeta, TableMeta } from '@datascriba/shared-types'

/**
 * Veri kaynağı şema özeti — AI prompt'larına gönderilir.
 * Sadece AI'ın ihtiyacı olan meta bilgiyi içerir.
 */
export interface SchemaContext {
  dataSourceId: string
  tables: Array<{
    schema: string
    name: string
    type: TableMeta['type']
    columns: ColumnMeta[]
  }>
}

/**
 * SQL öneri isteği payload'u.
 */
export interface SuggestQueryRequest {
  prompt: string
  dataSourceId: string
  schemaContext: SchemaContext
}

/**
 * SQL açıklama isteği payload'u.
 */
export interface ExplainQueryRequest {
  sql: string
}

/**
 * SQL düzeltme isteği payload'u.
 */
export interface FixQueryRequest {
  sql: string
  errorMessage: string
}

/**
 * Streaming olmayan (tek seferlik) AI yanıtı.
 */
export interface AiTextResponse {
  text: string
  /** Anthropic model ID */
  model: string
  /** Input token sayısı (cache hit dahil) */
  inputTokens: number
  /** Output token sayısı */
  outputTokens: number
  /** Cache'e yazılan token sayısı (varsa) */
  cacheCreationInputTokens: number
  /** Cache'ten okunan token sayısı (varsa) */
  cacheReadInputTokens: number
}

/**
 * Streaming SSE chunk — frontend bu formatı bekler.
 */
export interface AiStreamChunk {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}

/**
 * AiClient konfigürasyonu.
 */
export interface AiClientConfig {
  apiKey: string
  model: string
  maxTokens?: number
}
```

---

### STEP-03: packages/ai-client/src/prompts/suggest-query.ts

**Oluşturulacak dosya:** `packages/ai-client/src/prompts/suggest-query.ts`

**Bağımlılıklar:** STEP-02

```typescript
import type { SchemaContext } from '../types'

/**
 * Cache'lenecek sistem promptu — suggest-query için.
 * Kısa tutulur, şema context ayrı mesajda gönderilir.
 */
export const SUGGEST_QUERY_SYSTEM_PROMPT = `You are an expert SQL assistant specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to generate a valid T-SQL SELECT query based on the user's natural language request and the provided database schema.

Rules:
- Output ONLY the SQL query, no explanation, no markdown code fences.
- Use only the tables and columns from the provided schema.
- Never use DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, CREATE, or EXEC.
- Use proper T-SQL syntax: square bracket identifiers [schema].[table].[column].
- Always qualify table names with their schema (e.g. [dbo].[Orders]).
- Use TOP instead of LIMIT for row limiting.
- If the request is ambiguous, generate the most reasonable interpretation.
- If the request cannot be fulfilled with the given schema, respond with a single line: -- CANNOT_GENERATE: <reason>
`.trim()

/**
 * Kullanıcı mesajını şema context ile birleştirir.
 */
export function buildSuggestQueryUserMessage(
  prompt: string,
  schemaContext: SchemaContext,
): string {
  const schemaLines: string[] = ['-- DATABASE SCHEMA --']

  for (const table of schemaContext.tables) {
    schemaLines.push(`\nTable: [${table.schema}].[${table.name}] (${table.type})`)
    schemaLines.push('Columns:')
    for (const col of table.columns) {
      const pk = col.isPrimaryKey ? ' [PK]' : ''
      const nullable = col.nullable ? ' NULL' : ' NOT NULL'
      const def = col.defaultValue !== null ? ` DEFAULT ${col.defaultValue}` : ''
      schemaLines.push(`  - ${col.name}: ${col.dataType}${nullable}${pk}${def}`)
    }
  }

  schemaLines.push('\n-- USER REQUEST --')
  schemaLines.push(prompt)

  return schemaLines.join('\n')
}
```

---

### STEP-04: packages/ai-client/src/prompts/explain-query.ts

**Oluşturulacak dosya:** `packages/ai-client/src/prompts/explain-query.ts`

**Bağımlılıklar:** STEP-02

```typescript
/**
 * Cache'lenecek sistem promptu — explain-query için.
 */
export const EXPLAIN_QUERY_SYSTEM_PROMPT = `You are an expert SQL educator specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to explain a given SQL query in both Turkish and English.

Output format (strict):
---TR---
<Türkçe açıklama — 2-4 cümle, teknik ama anlaşılır>
---EN---
<English explanation — 2-4 sentences, technical but clear>

Rules:
- Always use both language sections in exactly this format.
- Explain what the query does, what tables it accesses, what conditions it applies, and what result it returns.
- Do not rewrite the query. Do not suggest improvements unless explicitly asked.
- If the input is not valid SQL, write: ---TR---\nGeçersiz SQL.\n---EN---\nInvalid SQL.
`.trim()

/**
 * Kullanıcı mesajını oluşturur.
 */
export function buildExplainQueryUserMessage(sql: string): string {
  return `Explain this SQL query:\n\n${sql}`
}
```

---

### STEP-05: packages/ai-client/src/prompts/fix-query.ts

**Oluşturulacak dosya:** `packages/ai-client/src/prompts/fix-query.ts`

**Bağımlılıklar:** STEP-02

```typescript
/**
 * Cache'lenecek sistem promptu — fix-query için.
 */
export const FIX_QUERY_SYSTEM_PROMPT = `You are an expert SQL debugger specializing in Microsoft SQL Server (MSSQL / T-SQL).
Your task is to fix a broken SQL query given the original query and the error message.

Rules:
- Output ONLY the corrected SQL query, no explanation, no markdown code fences.
- Preserve the original intent of the query.
- Use proper T-SQL syntax.
- If the error cannot be fixed (e.g. references non-existent objects you cannot know), output the original query unchanged with a comment: -- FIX_FAILED: <reason>
`.trim()

/**
 * Kullanıcı mesajını oluşturur.
 */
export function buildFixQueryUserMessage(sql: string, errorMessage: string): string {
  return `Fix this SQL query.\n\nError: ${errorMessage}\n\nQuery:\n${sql}`
}
```

---

### STEP-06: packages/ai-client/src/client.ts

**Oluşturulacak dosya:** `packages/ai-client/src/client.ts`

**Bağımlılıklar:** STEP-02, STEP-03, STEP-04, STEP-05

```typescript
import Anthropic from '@anthropic-ai/sdk'

import {
  buildExplainQueryUserMessage,
  EXPLAIN_QUERY_SYSTEM_PROMPT,
} from './prompts/explain-query'
import {
  buildFixQueryUserMessage,
  FIX_QUERY_SYSTEM_PROMPT,
} from './prompts/fix-query'
import {
  buildSuggestQueryUserMessage,
  SUGGEST_QUERY_SYSTEM_PROMPT,
} from './prompts/suggest-query'
import type {
  AiClientConfig,
  AiStreamChunk,
  AiTextResponse,
  ExplainQueryRequest,
  FixQueryRequest,
  SuggestQueryRequest,
} from './types'

const DEFAULT_MAX_TOKENS = 2048

/**
 * Anthropic SDK wrapper.
 * Prompt caching etkin: sistem promptları `cache_control: { type: 'ephemeral' }` ile cache'lenir.
 * Ephemeral cache TTL: 5 dakika (Anthropic default).
 */
export class AiClient {
  private readonly client: Anthropic
  private readonly model: string
  private readonly maxTokens: number

  constructor(config: AiClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
  }

  /**
   * Kullanıcının doğal dil isteğine göre SQL sorgusu önerir.
   * Streaming — her chunk AsyncIterable<AiStreamChunk> ile döner.
   */
  async *suggestQuery(req: SuggestQueryRequest): AsyncIterable<AiStreamChunk> {
    const userContent = buildSuggestQueryUserMessage(req.prompt, req.schemaContext)

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: SUGGEST_QUERY_SYSTEM_PROMPT,
          // @ts-expect-error -- cache_control is supported in the API but not yet typed in all SDK versions
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { type: 'delta', text: event.delta.text }
      }
    }

    yield { type: 'done' }
  }

  /**
   * SQL sorgusunu Türkçe ve İngilizce olarak açıklar.
   * Tek seferlik (non-streaming) yanıt döner.
   */
  async explainQuery(req: ExplainQueryRequest): Promise<AiTextResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: EXPLAIN_QUERY_SYSTEM_PROMPT,
          // @ts-expect-error -- cache_control is supported in the API but not yet typed in all SDK versions
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildExplainQueryUserMessage(req.sql),
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : ''

    return {
      text,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens:
        // @ts-expect-error -- cache_creation_input_tokens is API field not in all SDK type versions
        (response.usage.cache_creation_input_tokens as number | undefined) ?? 0,
      cacheReadInputTokens:
        // @ts-expect-error -- cache_read_input_tokens is API field not in all SDK type versions
        (response.usage.cache_read_input_tokens as number | undefined) ?? 0,
    }
  }

  /**
   * Hatalı SQL'i hata mesajıyla birlikte düzeltir.
   * Streaming — her chunk AsyncIterable<AiStreamChunk> ile döner.
   */
  async *fixQuery(req: FixQueryRequest): AsyncIterable<AiStreamChunk> {
    const userContent = buildFixQueryUserMessage(req.sql, req.errorMessage)

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: FIX_QUERY_SYSTEM_PROMPT,
          // @ts-expect-error -- cache_control is supported in the API but not yet typed in all SDK versions
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { type: 'delta', text: event.delta.text }
      }
    }

    yield { type: 'done' }
  }
}
```

---

### STEP-07: packages/ai-client/src/index.ts (Exports)

**Oluşturulacak dosya:** `packages/ai-client/src/index.ts`

**Bağımlılıklar:** STEP-06

```typescript
export { AiClient } from './client'
export type {
  AiClientConfig,
  AiStreamChunk,
  AiTextResponse,
  ExplainQueryRequest,
  FixQueryRequest,
  SchemaContext,
  SuggestQueryRequest,
} from './types'
```

---

### STEP-08: packages/shared-types/src/ai.ts (Paylaşılan AI Tipleri)

**Oluşturulacak dosya:** `packages/shared-types/src/ai.ts`

**Bağımlılıklar:** Yok (shared-types bağımsız)

Bu dosya frontend ve backend arasında paylaşılan HTTP request/response tiplerini tanımlar. `packages/ai-client/src/types.ts` iç SDK tiplerini içerirken bu dosya HTTP katmanı tiplerini içerir.

```typescript
/**
 * AI HTTP endpoint request/response tipleri.
 * Frontend ve backend tarafından import edilir.
 */

/** POST /ai/suggest-query request body */
export interface SuggestQueryBody {
  prompt: string
  dataSourceId: string
}

/** POST /ai/explain-query request body */
export interface ExplainQueryBody {
  sql: string
}

/** POST /ai/fix-query request body */
export interface FixQueryBody {
  sql: string
  errorMessage: string
}

/**
 * explain-query endpoint yanıtı (non-streaming).
 * Türkçe ve İngilizce bölümleri ayrıştırılmış halde döner.
 */
export interface ExplainQueryResponse {
  turkish: string
  english: string
  model: string
}

/**
 * Streaming SSE event data tipi.
 * suggest-query ve fix-query endpoint'leri bu formatı kullanır.
 * Her SSE satırı: `data: <JSON>\n\n`
 */
export interface AiSseChunk {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}
```

---

### STEP-09: packages/shared-types/src/index.ts Güncellemesi

**Güncellenecek dosya:** `packages/shared-types/src/index.ts`

**Bağımlılıklar:** STEP-08

Mevcut içerik korunur, ai.ts export'u eklenir:

```typescript
export type { ApiResponse, PaginatedResponse } from './common'
export type {
  DataSourceType,
  TableMeta,
  ColumnMeta,
  Row,
  QueryResult,
  DataSourceRecord,
} from './data-source'
export type {
  ExportFormat,
  ReportParameterType,
  ReportParameter,
  ReportDefinition,
  RunStatus,
  RunRecord,
} from './report'
export type {
  SuggestQueryBody,
  ExplainQueryBody,
  FixQueryBody,
  ExplainQueryResponse,
  AiSseChunk,
} from './ai'
```

---

### STEP-10: apps/api — env.ts Güncellemesi

**Güncellenecek dosya:** `apps/api/src/config/env.ts`

**Bağımlılıklar:** STEP-01 (yeni paket eklenince önce env güncellenir)

`ANTHROPIC_API_KEY` ve `AI_MODEL` env değişkenleri eklenir. `AI_MODEL` default olarak `claude-sonnet-4-6` ancak `.env` dosyasından override edilebilir.

```typescript
import { z } from 'zod'

const HEX_64 = /^[0-9a-fA-F]{64}$/

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().optional(),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .regex(HEX_64, 'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)'),
  /** Anthropic API anahtarı — AI özellikleri için zorunlu */
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  /** Kullanılacak Claude modeli. Varsayılan: claude-sonnet-4-6 */
  AI_MODEL: z.string().default('claude-sonnet-4-6'),
  /** AI endpoint başına dakikada maksimum istek sayısı */
  AI_RATE_LIMIT_RPM: z.coerce.number().int().min(1).default(10),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validates process.env at startup. Exits with code 1 if any required
 * variable is missing or malformed. App refuses to start on failure.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    process.stderr.write(`Environment validation failed:\n${formatted}\n`)
    process.exit(1)
  }
  return result.data
}

/**
 * Exported parsed env — call validateEnv() first in main.ts.
 * Tests can set process.env before importing this module.
 */
export const env: Env = (() => {
  const result = envSchema.safeParse(process.env)
  if (result.success) return result.data
  return {
    NODE_ENV: 'development',
    API_PORT: 3001,
    API_HOST: '0.0.0.0',
    ENCRYPTION_MASTER_KEY: process.env['ENCRYPTION_MASTER_KEY'] ?? '',
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? '',
    AI_MODEL: process.env['AI_MODEL'] ?? 'claude-sonnet-4-6',
    AI_RATE_LIMIT_RPM: 10,
  } as Env
})()
```

---

### STEP-11: apps/api/package.json Güncellemesi

**Güncellenecek dosya:** `apps/api/package.json`

**Bağımlılıklar:** STEP-01 (paket oluşturulmuş olmalı)

`dependencies` bölümüne eklenenler:
- `@datascriba/ai-client`: `workspace:*`
- `@nestjs/throttler`: `^6.4.0`

Tam güncellenmiş `package.json`:

```json
{
  "name": "@datascriba/api",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "start:prod": "NODE_ENV=production node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "lint:check": "eslint \"{src,test}/**/*.ts\"",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "format": "prettier --write \"{src,test}/**/*.ts\""
  },
  "dependencies": {
    "@datascriba/ai-client": "workspace:*",
    "@datascriba/db-drivers": "workspace:*",
    "@datascriba/report-engine": "workspace:*",
    "@datascriba/shared-types": "workspace:*",
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-fastify": "^10.4.15",
    "@nestjs/swagger": "^8.1.0",
    "@nestjs/throttler": "^6.4.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "fastify": "^5.2.1",
    "mssql": "^11.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@datascriba/eslint-config": "workspace:*",
    "@datascriba/tsconfig": "workspace:*",
    "@nestjs/cli": "^10.4.9",
    "@nestjs/testing": "^10.4.15",
    "@swc/core": "^1.15.33",
    "@types/mssql": "^9.1.5",
    "@types/node": "^22.10.7",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vitest/coverage-v8": "^2.1.9",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "prettier": "^3.3.3",
    "supertest": "^7.0.0",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

**Not:** Mevcut `@nestjs/config` versiyonu `^3.3.0`'dı; `@nestjs/common`/`@nestjs/core` ile uyumlu olması için builder paketi `^3.3.0` olarak bırakabilir. Önemli olan `@datascriba/ai-client` ve `@nestjs/throttler` eklenmesidir.

---

### STEP-12: apps/api/src/modules/ai/dto/suggest-query.dto.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/dto/suggest-query.dto.ts`

**Bağımlılıklar:** STEP-10

```typescript
import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator'

export class SuggestQueryDto {
  @ApiProperty({
    description: 'Natural language description of the desired SQL query',
    example: 'Show me total sales grouped by product category for last month',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  prompt!: string

  @ApiProperty({
    description: 'ID of the data source to query schema from',
    format: 'uuid',
  })
  @IsString()
  @IsUUID()
  dataSourceId!: string
}
```

---

### STEP-13: apps/api/src/modules/ai/dto/explain-query.dto.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/dto/explain-query.dto.ts`

**Bağımlılıklar:** STEP-10

```typescript
import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength } from 'class-validator'

export class ExplainQueryDto {
  @ApiProperty({
    description: 'SQL query to explain',
    example: 'SELECT TOP 10 * FROM [dbo].[Orders] WHERE [Status] = @p1',
    minLength: 10,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  sql!: string
}
```

---

### STEP-14: apps/api/src/modules/ai/dto/fix-query.dto.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/dto/fix-query.dto.ts`

**Bağımlılıklar:** STEP-10

```typescript
import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength } from 'class-validator'

export class FixQueryDto {
  @ApiProperty({
    description: 'The broken SQL query',
    example: 'SELECT * FORM Orders',
    minLength: 5,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  sql!: string

  @ApiProperty({
    description: 'The SQL error message returned by the database',
    example: "Incorrect syntax near 'FORM'.",
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  errorMessage!: string
}
```

---

### STEP-15: apps/api/src/modules/ai/ai.service.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/ai.service.ts`

**Bağımlılıklar:** STEP-07 (ai-client exports), STEP-10 (env), STEP-12, STEP-13, STEP-14

Bu servis:
1. `DataSourceService.listTables()` + `describeTable()` kullanarak şema context oluşturur
2. `AiClient` üzerinden ilgili metodu çağırır
3. Streaming operasyonlar için `AsyncIterable<AiStreamChunk>` döner

```typescript
import { AiClient } from '@datascriba/ai-client'
import type { AiStreamChunk, SchemaContext } from '@datascriba/ai-client'
import type { ExplainQueryResponse } from '@datascriba/shared-types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env'
import { DataSourceService } from '../data-source/data-source.service'
import type { ExplainQueryDto } from './dto/explain-query.dto'
import type { FixQueryDto } from './dto/fix-query.dto'
import type { SuggestQueryDto } from './dto/suggest-query.dto'

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)
  private client!: AiClient

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly dataSourceService: DataSourceService,
  ) {}

  onModuleInit(): void {
    this.client = new AiClient({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
      model: this.config.get('AI_MODEL'),
      maxTokens: 2048,
    })
    this.logger.log(
      { model: this.config.get('AI_MODEL') },
      'AiService initialized',
    )
  }

  /**
   * Veri kaynağının tam şemasını getirir.
   * Tüm tablolar + her tablonun kolonları — AI prompt context'i için.
   */
  private async buildSchemaContext(dataSourceId: string): Promise<SchemaContext> {
    const tables = await this.dataSourceService.listTables(dataSourceId)
    const tablesWithColumns = await Promise.all(
      tables.map(async (table) => {
        const fullName = `${table.schema}.${table.name}`
        const columns = await this.dataSourceService.describeTable(
          dataSourceId,
          fullName,
        )
        return {
          schema: table.schema,
          name: table.name,
          type: table.type,
          columns,
        }
      }),
    )
    return { dataSourceId, tables: tablesWithColumns }
  }

  /**
   * Doğal dil prompt'tan SQL önerisi üretir.
   * Streaming — AsyncIterable<AiStreamChunk> döner.
   */
  async *suggestQuery(dto: SuggestQueryDto): AsyncIterable<AiStreamChunk> {
    this.logger.log(
      { dataSourceId: dto.dataSourceId },
      'AI suggest-query started',
    )
    const schemaContext = await this.buildSchemaContext(dto.dataSourceId)

    yield* this.client.suggestQuery({
      prompt: dto.prompt,
      dataSourceId: dto.dataSourceId,
      schemaContext,
    })

    this.logger.log(
      { dataSourceId: dto.dataSourceId },
      'AI suggest-query completed',
    )
  }

  /**
   * SQL sorgusunu Türkçe ve İngilizce açıklar.
   * Non-streaming — tam yanıt döner.
   */
  async explainQuery(dto: ExplainQueryDto): Promise<ExplainQueryResponse> {
    this.logger.log('AI explain-query started')
    const result = await this.client.explainQuery({ sql: dto.sql })

    const { turkish, english } = this.parseExplainResponse(result.text)

    this.logger.log(
      {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadInputTokens: result.cacheReadInputTokens,
      },
      'AI explain-query completed',
    )

    return { turkish, english, model: result.model }
  }

  /**
   * Hatalı SQL'i düzeltir.
   * Streaming — AsyncIterable<AiStreamChunk> döner.
   */
  async *fixQuery(dto: FixQueryDto): AsyncIterable<AiStreamChunk> {
    this.logger.log('AI fix-query started')

    yield* this.client.fixQuery({
      sql: dto.sql,
      errorMessage: dto.errorMessage,
    })

    this.logger.log('AI fix-query completed')
  }

  /**
   * explain-query yanıtını ---TR--- / ---EN--- bölümlerine ayırır.
   */
  private parseExplainResponse(text: string): {
    turkish: string
    english: string
  } {
    const trMatch = /---TR---\s*([\s\S]*?)(?=---EN---|$)/i.exec(text)
    const enMatch = /---EN---\s*([\s\S]*?)$/i.exec(text)
    return {
      turkish: trMatch?.[1]?.trim() ?? text,
      english: enMatch?.[1]?.trim() ?? '',
    }
  }
}
```

---

### STEP-16: apps/api/src/modules/ai/ai.controller.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/ai.controller.ts`

**Bağımlılıklar:** STEP-15

**Önemli notlar:**
- `suggest-query` ve `fix-query`: SSE endpoint (`@Sse()`), Fastify uyumlu
- `explain-query`: Normal POST endpoint, JSON yanıt
- `@Throttle()` decorator ile rate limit (ThrottlerGuard controller seviyesinde uygulanır)
- SSE: `Observable<MessageEvent>` — RxJS `from()` ile `AsyncIterable` → `Observable` dönüşümü

```typescript
import type { AiStreamChunk } from '@datascriba/ai-client'
import type { AiSseChunk, ExplainQueryResponse } from '@datascriba/shared-types'
import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Observable, from, map } from 'rxjs'

import { AiService } from './ai.service'
import { ExplainQueryDto } from './dto/explain-query.dto'
import { FixQueryDto } from './dto/fix-query.dto'
import { SuggestQueryDto } from './dto/suggest-query.dto'

/**
 * AsyncIterable<AiStreamChunk> → Observable<MessageEvent> dönüştürücü.
 * NestJS SSE (@Sse) Observable<MessageEvent> bekler.
 */
function chunkToSse(
  iterable: AsyncIterable<AiStreamChunk>,
): Observable<MessageEvent> {
  return from(iterable).pipe(
    map((chunk): MessageEvent => {
      const data: AiSseChunk = {
        type: chunk.type,
        text: chunk.text,
        error: chunk.error,
      }
      return { data }
    }),
  )
}

@ApiTags('AI')
@Controller('ai')
@UseGuards(ThrottlerGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  @Sse('suggest-query')
  @ApiOperation({
    summary: 'Generate SQL from natural language (streaming SSE)',
  })
  @ApiBody({ type: SuggestQueryDto })
  @ApiOkResponse({
    description: 'Server-Sent Events stream of SQL tokens',
  })
  suggestQuery(@Body() dto: SuggestQueryDto): Observable<MessageEvent> {
    return chunkToSse(this.service.suggestQuery(dto))
  }

  @Post('explain-query')
  @ApiOperation({ summary: 'Explain a SQL query in Turkish and English' })
  @ApiBody({ type: ExplainQueryDto })
  @ApiOkResponse({
    description: 'Explanation in Turkish and English',
  })
  async explainQuery(
    @Body() dto: ExplainQueryDto,
  ): Promise<ExplainQueryResponse> {
    return this.service.explainQuery(dto)
  }

  @Sse('fix-query')
  @ApiOperation({
    summary: 'Fix a broken SQL query (streaming SSE)',
  })
  @ApiBody({ type: FixQueryDto })
  @ApiOkResponse({
    description: 'Server-Sent Events stream of corrected SQL tokens',
  })
  fixQuery(@Body() dto: FixQueryDto): Observable<MessageEvent> {
    return chunkToSse(this.service.fixQuery(dto))
  }
}
```

**Mimari Not — SSE + POST uyumluluk:** NestJS `@Sse()` decorator herhangi bir HTTP metoduyla kullanılabilir. Fastify adaptörü `Content-Type: text/event-stream` header'ını NestJS SSE altyapısı otomatik set eder. Body taşımak için POST zorunludur. Eğer Fastify + SSE + POST birlikte çalışmazsa alternatif: body'yi query string'e taşı ve GET kullan (`?prompt=...&dataSourceId=...`). Builder bu durumu test ederek karar verir.

---

### STEP-17: apps/api/src/modules/ai/ai.module.ts

**Oluşturulacak dosya:** `apps/api/src/modules/ai/ai.module.ts`

**Bağımlılıklar:** STEP-15, STEP-16

```typescript
import { Module } from '@nestjs/common'

import { DataSourceModule } from '../data-source/data-source.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [DataSourceModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
```

---

### STEP-18: apps/api/src/app.module.ts Güncellemesi

**Güncellenecek dosya:** `apps/api/src/app.module.ts`

**Bağımlılıklar:** STEP-11 (throttler bağımlılığı), STEP-17 (AiModule)

`ThrottlerModule` ve `AiModule` eklenir.

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import type { Env } from './config/env'
import { AiModule } from './modules/ai/ai.module'
import { DataSourceModule } from './modules/data-source/data-source.module'
import { ReportModule } from './modules/report/report.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: 'ai',
          ttl: 60_000,
          limit: config.get('AI_RATE_LIMIT_RPM'),
        },
      ],
    }),
    DataSourceModule,
    ReportModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule {}
```

---

### STEP-19: apps/api/src/common/filters/app-exception.filter.ts Güncellemesi

**Güncellenecek dosya:** `apps/api/src/common/filters/app-exception.filter.ts`

**Bağımlılıklar:** STEP-11

`ThrottlerException` mapping eklenir. Tam güncellenmiş dosya:

```typescript
import {
  ConnectionError,
  DataSourceError,
  DangerousQueryError,
  EncryptionError,
  QueryBlockedError,
  QueryError,
  UnsupportedDriverError,
} from '@datascriba/db-drivers'
import {
  ParameterValidationError,
  RenderError,
  TemplateError,
  UnsupportedFormatError,
} from '@datascriba/report-engine'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'

interface ErrorResponse {
  statusCode: number
  error: string
  message: string
  timestamp: string
  path: string
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const reply = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { statusCode, message } = this.mapException(exception)

    const body: ErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (statusCode >= 500) {
      this.logger.error({ err: exception, path: request.url }, message)
    } else {
      this.logger.warn({ path: request.url }, message)
    }

    void reply.status(statusCode).send(body)
  }

  private mapException(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof ThrottlerException) {
      return { statusCode: 429, message: 'Too many requests. Please wait before retrying.' }
    }
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: exception.message }
    }
    if (exception instanceof DangerousQueryError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof QueryBlockedError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof ConnectionError) {
      return { statusCode: 503, message: 'Data source connection failed' }
    }
    if (exception instanceof QueryError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Query execution failed' }
    }
    if (exception instanceof UnsupportedDriverError) {
      return { statusCode: 501, message: exception.message }
    }
    if (exception instanceof EncryptionError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Encryption error' }
    }
    if (exception instanceof DataSourceError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Data source error' }
    }
    if (exception instanceof ParameterValidationError) {
      return { statusCode: 422, message: exception.message }
    }
    if (exception instanceof TemplateError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof UnsupportedFormatError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof RenderError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: exception.message }
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
```

---

### STEP-20: apps/web/package.json Güncellemesi

**Güncellenecek dosya:** `apps/web/package.json`

**Bağımlılıklar:** Yok (frontend bağımlılık ekleme)

`@radix-ui/react-collapsible` eklenir. Tam güncellenmiş `package.json`:

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.3.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.56.2",
    "@tanstack/react-query-devtools": "^5.56.2",
    "zustand": "^5.0.1",
    "zundo": "^2.2.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "next-intl": "^3.22.2",
    "next-themes": "^0.4.3",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.447.0",
    "@radix-ui/react-collapsible": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.2",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@monaco-editor/react": "^4.6.0",
    "date-fns": "^4.1.0",
    "@datascriba/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.4",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.47",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

---

### STEP-21: apps/web/src/components/ui/collapsible.tsx

**Oluşturulacak dosya:** `apps/web/src/components/ui/collapsible.tsx`

**Bağımlılıklar:** STEP-20

shadcn/ui pattern'ine uygun Radix Collapsible wrapper:

```tsx
'use client'

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

---

### STEP-22: apps/web/src/components/ui/tabs.tsx

**Oluşturulacak dosya:** `apps/web/src/components/ui/tabs.tsx`

**Bağımlılıklar:** `@radix-ui/react-tabs` (zaten `web/package.json`'da var)

shadcn/ui pattern'ine uygun Tabs bileşeni:

```tsx
'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

---

### STEP-23: apps/web/src/hooks/use-ai.ts

**Oluşturulacak dosya:** `apps/web/src/hooks/use-ai.ts`

**Bağımlılıklar:** STEP-08 (shared-types/ai.ts), STEP-09 (shared-types index)

```typescript
'use client'

import type {
  AiSseChunk,
  ExplainQueryBody,
  ExplainQueryResponse,
  FixQueryBody,
  SuggestQueryBody,
} from '@datascriba/shared-types'
import { useCallback, useState } from 'react'

import { env } from '@/lib/env'

interface StreamState {
  text: string
  isStreaming: boolean
  error: string | null
}

const INITIAL_STREAM_STATE: StreamState = {
  text: '',
  isStreaming: false,
  error: null,
}

/**
 * SSE stream okuyan generic yardımcı.
 * `onChunk` her delta'da, `onDone` tamamlanınca çağrılır.
 */
async function readSseStream(
  url: string,
  body: unknown,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_URL}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    })
  } catch {
    onError('Network error. Please check your connection.')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    onError(`API error ${response.status}: ${text}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('Response body is not readable.')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Son satır incomplete olabilir — buffer'a geri al
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw) continue

        let chunk: AiSseChunk
        try {
          chunk = JSON.parse(raw) as AiSseChunk
        } catch {
          continue
        }

        if (chunk.type === 'delta' && chunk.text) {
          onChunk(chunk.text)
        } else if (chunk.type === 'done') {
          onDone()
        } else if (chunk.type === 'error') {
          onError(chunk.error ?? 'Unknown stream error')
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Doğal dil -> SQL öneri hook'u.
 * Streaming SSE ile karakter karakter gösterim.
 */
export function useSuggestQuery(): {
  suggest: (body: SuggestQueryBody) => Promise<void>
  state: StreamState
  reset: () => void
} {
  const [state, setState] = useState<StreamState>(INITIAL_STREAM_STATE)

  const reset = useCallback(() => setState(INITIAL_STREAM_STATE), [])

  const suggest = useCallback(async (body: SuggestQueryBody): Promise<void> => {
    setState({ text: '', isStreaming: true, error: null })

    await readSseStream(
      '/api/v1/ai/suggest-query',
      body,
      (chunk) => setState((prev) => ({ ...prev, text: prev.text + chunk })),
      () => setState((prev) => ({ ...prev, isStreaming: false })),
      (err) => setState({ text: '', isStreaming: false, error: err }),
    )
  }, [])

  return { suggest, state, reset }
}

/**
 * SQL açıklama hook'u.
 * Non-streaming, tek seferlik yanıt.
 */
export function useExplainQuery(): {
  explain: (body: ExplainQueryBody) => Promise<void>
  response: ExplainQueryResponse | null
  isLoading: boolean
  error: string | null
  reset: () => void
} {
  const [response, setResponse] = useState<ExplainQueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  const explain = useCallback(async (body: ExplainQueryBody): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/ai/explain-query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error')
        setError(`API error ${res.status}: ${text}`)
        return
      }
      const data = (await res.json()) as ExplainQueryResponse
      setResponse(data)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { explain, response, isLoading, error, reset }
}

/**
 * SQL düzeltme hook'u.
 * Streaming SSE ile karakter karakter gösterim.
 */
export function useFixQuery(): {
  fix: (body: FixQueryBody) => Promise<void>
  state: StreamState
  reset: () => void
} {
  const [state, setState] = useState<StreamState>(INITIAL_STREAM_STATE)

  const reset = useCallback(() => setState(INITIAL_STREAM_STATE), [])

  const fix = useCallback(async (body: FixQueryBody): Promise<void> => {
    setState({ text: '', isStreaming: true, error: null })

    await readSseStream(
      '/api/v1/ai/fix-query',
      body,
      (chunk) => setState((prev) => ({ ...prev, text: prev.text + chunk })),
      () => setState((prev) => ({ ...prev, isStreaming: false })),
      (err) => setState({ text: '', isStreaming: false, error: err }),
    )
  }, [])

  return { fix, state, reset }
}
```

---

### STEP-24: apps/web/src/components/ai/ai-assistant-panel.tsx

**Oluşturulacak dosya:** `apps/web/src/components/ai/ai-assistant-panel.tsx`

**Bağımlılıklar:** STEP-21, STEP-22, STEP-23

Bu bileşen:
- Sağ tarafta collapsible panel olarak render edilir
- 3 sekme: "SQL Öner", "Açıkla", "Düzelt"
- Her sekmede ilgili hook kullanılır
- "Uygula" butonu `onApplySql` callback'i ile Monaco editöre SQL yerleştirir
- Streaming text karakter karakter gösterilir (`pre` tag + mono font)
- AI accent rengi: `violet-500`

```tsx
'use client'

import { ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExplainQuery, useFixQuery, useSuggestQuery } from '@/hooks/use-ai'

interface AiAssistantPanelProps {
  /** Aktif rapor editörünün seçili veri kaynağı ID'si */
  dataSourceId: string
  /** Mevcut SQL editörün içeriği */
  currentSql: string
  /** "Uygula" butonuna basıldığında editöre SQL yazan callback */
  onApplySql: (sql: string) => void
}

export function AiAssistantPanel({
  dataSourceId,
  currentSql,
  onApplySql,
}: AiAssistantPanelProps): JSX.Element {
  const t = useTranslations('ai')
  const [isOpen, setIsOpen] = useState(false)
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState('')
  const [fixErrorMessage, setFixErrorMessage] = useState('')

  const { suggest, state: suggestState, reset: resetSuggest } = useSuggestQuery()
  const {
    explain,
    response: explainResponse,
    isLoading: isExplaining,
    error: explainError,
    reset: resetExplain,
  } = useExplainQuery()
  const { fix, state: fixState, reset: resetFix } = useFixQuery()

  function handleSuggest(): void {
    if (!naturalLanguagePrompt.trim() || !dataSourceId) return
    resetSuggest()
    void suggest({ prompt: naturalLanguagePrompt.trim(), dataSourceId })
  }

  function handleExplain(): void {
    if (!currentSql.trim()) return
    resetExplain()
    void explain({ sql: currentSql })
  }

  function handleFix(): void {
    if (!currentSql.trim() || !fixErrorMessage.trim()) return
    resetFix()
    void fix({ sql: currentSql, errorMessage: fixErrorMessage.trim() })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex">
      {/* Toggle trigger — panel kapalıyken dar bir şerit */}
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-center w-7 shrink-0 bg-muted/40 hover:bg-muted border-l border-border transition-colors"
          aria-label={isOpen ? t('closePanel') : t('openPanel')}
        >
          {isOpen ? (
            <ChevronRight className="h-4 w-4 text-violet-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-violet-400" />
          )}
        </button>
      </CollapsibleTrigger>

      {/* Panel içeriği */}
      <CollapsibleContent className="w-80 shrink-0 border-l border-border bg-background overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Başlık */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">
              {t('panelTitle')}
            </span>
          </div>

          <Tabs defaultValue="suggest">
            <TabsList className="w-full">
              <TabsTrigger value="suggest" className="flex-1 text-xs">
                {t('tabSuggest')}
              </TabsTrigger>
              <TabsTrigger value="explain" className="flex-1 text-xs">
                {t('tabExplain')}
              </TabsTrigger>
              <TabsTrigger value="fix" className="flex-1 text-xs">
                {t('tabFix')}
              </TabsTrigger>
            </TabsList>

            {/* SQL ONERME sekmesi */}
            <TabsContent value="suggest" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('suggestPromptLabel')}</Label>
                <textarea
                  className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t('suggestPromptPlaceholder')}
                  value={naturalLanguagePrompt}
                  onChange={(e) => setNaturalLanguagePrompt(e.target.value)}
                  disabled={suggestState.isStreaming}
                />
              </div>

              {!dataSourceId && (
                <p className="text-xs text-amber-500">{t('noDataSourceWarning')}</p>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={handleSuggest}
                disabled={
                  suggestState.isStreaming ||
                  !naturalLanguagePrompt.trim() ||
                  !dataSourceId
                }
              >
                {suggestState.isStreaming ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-3 w-3" />
                    {t('suggestButton')}
                  </>
                )}
              </Button>

              {suggestState.error && (
                <p className="text-xs text-destructive">{suggestState.error}</p>
              )}

              {(suggestState.text || suggestState.isStreaming) && (
                <div className="space-y-2">
                  <pre className="w-full min-h-[80px] max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-2 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                    {suggestState.text}
                    {suggestState.isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                  {!suggestState.isStreaming && suggestState.text && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                      onClick={() => onApplySql(suggestState.text)}
                    >
                      {t('applyToEditor')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ACIKLAMA sekmesi */}
            <TabsContent value="explain" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('explainDescription')}
              </p>

              <Button
                size="sm"
                className="w-full"
                onClick={handleExplain}
                disabled={isExplaining || !currentSql.trim()}
              >
                {isExplaining ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('explaining')}
                  </>
                ) : (
                  t('explainButton')
                )}
              </Button>

              {explainError && (
                <p className="text-xs text-destructive">{explainError}</p>
              )}

              {explainResponse && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Turkce</Label>
                    <p className="text-xs leading-relaxed text-foreground">
                      {explainResponse.turkish}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">English</Label>
                    <p className="text-xs leading-relaxed text-foreground">
                      {explainResponse.english}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* DUZELTME sekmesi */}
            <TabsContent value="fix" className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('fixErrorLabel')}</Label>
                <textarea
                  className="w-full min-h-[60px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={t('fixErrorPlaceholder')}
                  value={fixErrorMessage}
                  onChange={(e) => setFixErrorMessage(e.target.value)}
                  disabled={fixState.isStreaming}
                />
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={handleFix}
                disabled={
                  fixState.isStreaming ||
                  !currentSql.trim() ||
                  !fixErrorMessage.trim()
                }
              >
                {fixState.isStreaming ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('fixing')}
                  </>
                ) : (
                  t('fixButton')
                )}
              </Button>

              {fixState.error && (
                <p className="text-xs text-destructive">{fixState.error}</p>
              )}

              {(fixState.text || fixState.isStreaming) && (
                <div className="space-y-2">
                  <pre className="w-full min-h-[80px] max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-2 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                    {fixState.text}
                    {fixState.isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-violet-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                  {!fixState.isStreaming && fixState.text && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                      onClick={() => onApplySql(fixState.text)}
                    >
                      {t('applyToEditor')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

---

### STEP-25: apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx Guncellemesi

**Guncellenecek dosya:** `apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx`

**Bagimliliklar:** STEP-24

Degisiklikler:
1. `AiAssistantPanel` import edilir
2. Ana layout `flex` olur — sol taraf mevcut editor (`flex-1`), sag taraf AI panel
3. Monaco editor `store.setField` callback'i `onApplySql`'e baglanir

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useReport, useCreateReport, useUpdateReport } from '@/hooks/use-reports'
import { useDataSources } from '@/hooks/use-data-sources'
import { useReportEditorStore } from '@/store/report-editor.store'
import { AiAssistantPanel } from '@/components/ai/ai-assistant-panel'
import { ParameterList } from './parameter-list'
import { useRouter } from 'next/navigation'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface ReportEditorClientProps {
  reportId?: string
}

export function ReportEditorClient({ reportId }: ReportEditorClientProps) {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const router = useRouter()

  const store = useReportEditorStore()
  const loadReport = useReportEditorStore((s) => s.loadReport)
  const { data: report } = useReport(reportId ?? '')
  const { data: dataSources } = useDataSources()
  const createReport = useCreateReport()
  const updateReport = useUpdateReport(reportId ?? '')

  useEffect(() => {
    if (report) {
      loadReport({
        id: report.id,
        name: report.name,
        description: report.description,
        dataSourceId: report.dataSourceId,
        query: report.query,
        parameters: report.parameters.map((p, i) => ({
          id: `param-${i}`,
          name: p.name,
          type: p.type,
          label: p.label,
          required: p.required,
          defaultValue: p.defaultValue,
          options: p.options,
        })),
        exportFormats: report.exportFormats,
      })
    }
  }, [report, loadReport])

  async function handleSave(): Promise<void> {
    try {
      const payload = {
        name: store.name,
        description: store.description || undefined,
        dataSourceId: store.dataSourceId,
        query: store.query,
        parameters: store.parameters,
        exportFormats: store.exportFormats,
      }
      if (reportId) {
        await updateReport.mutateAsync(payload)
      } else {
        const created = await createReport.mutateAsync(payload)
        const safeId = /^[\w-]+$/.test(created.id) ? created.id : null
        if (!safeId) throw new Error('Invalid report id returned from server')
        router.push(`/reports/${safeId}/edit`)
      }
      store.resetDirty()
    } catch (err) {
      throw err
    }
  }

  const isPending = createReport.isPending || updateReport.isPending

  return (
    <div className="flex h-full">
      {/* Ana editor alani */}
      <div className="flex-1 overflow-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {reportId ? t('editTitle') : t('createNew')}
          </h1>
          <div className="flex gap-2">
            {store.isDirty && (
              <span className="text-sm text-muted-foreground self-center">{tc('unsavedChanges')}</span>
            )}
            <Button onClick={handleSave} disabled={isPending}>
              {tc('save')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{tc('name')}</Label>
              <Input value={store.name} onChange={(e) => store.setField('name', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{tc('description')}</Label>
              <Input
                value={store.description}
                onChange={(e) => store.setField('description', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Data Source</Label>
              <Select
                value={store.dataSourceId}
                onValueChange={(v) => store.setField('dataSourceId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select data source..." />
                </SelectTrigger>
                <SelectContent>
                  {dataSources?.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('exportFormats')}</Label>
              <div className="flex gap-4">
                {(['csv', 'excel'] as const).map((fmt) => (
                  <div key={fmt} className="flex items-center gap-2">
                    <Switch
                      checked={store.exportFormats.includes(fmt)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...store.exportFormats, fmt]
                          : store.exportFormats.filter((f) => f !== fmt)
                        store.setField('exportFormats', next)
                      }}
                    />
                    <Label className="capitalize">{fmt}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t('query')}</Label>
            <div className="h-64 rounded-md border overflow-hidden">
              <MonacoEditor
                height="100%"
                language="sql"
                theme="vs-dark"
                value={store.query}
                onChange={(v) => store.setField('query', v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('parameters')}</Label>
          <ParameterList />
        </div>
      </div>

      {/* AI Yardimcisi paneli -- sagda, collapsible */}
      <AiAssistantPanel
        dataSourceId={store.dataSourceId}
        currentSql={store.query}
        onApplySql={(sql) => store.setField('query', sql)}
      />
    </div>
  )
}
```

---

### STEP-26: i18n Mesaj Dosyalari Guncellemesi

**Guncellenecek dosyalar:**
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/i18n/messages/tr.json`

Builder mevcut dosyalari okuyup `"ai"` namespace'ini ekler. Tum mevcut key'ler korunur.

**en.json — eklenecek `"ai"` blogu:**

```json
"ai": {
  "panelTitle": "Scriba AI",
  "openPanel": "Open AI Assistant",
  "closePanel": "Close AI Assistant",
  "tabSuggest": "Suggest",
  "tabExplain": "Explain",
  "tabFix": "Fix",
  "suggestPromptLabel": "Describe what you want to query",
  "suggestPromptPlaceholder": "e.g. Show total sales by month for last year",
  "suggestButton": "Generate SQL",
  "generating": "Generating...",
  "applyToEditor": "Apply to Editor",
  "noDataSourceWarning": "Select a data source first.",
  "explainDescription": "Explains the current SQL query in the editor in Turkish and English.",
  "explainButton": "Explain Query",
  "explaining": "Explaining...",
  "fixErrorLabel": "Error message from database",
  "fixErrorPlaceholder": "e.g. Incorrect syntax near 'FORM'.",
  "fixButton": "Fix Query",
  "fixing": "Fixing..."
}
```

**tr.json — eklenecek `"ai"` blogu:**

```json
"ai": {
  "panelTitle": "Scriba AI",
  "openPanel": "AI Yardimcisini Ac",
  "closePanel": "AI Yardimcisini Kapat",
  "tabSuggest": "Oner",
  "tabExplain": "Acikla",
  "tabFix": "Duzelt",
  "suggestPromptLabel": "Ne sorgulamak istediginizi aciklayin",
  "suggestPromptPlaceholder": "orn. Gecen yilin aylik toplam satislarini goster",
  "suggestButton": "SQL Uret",
  "generating": "Uretiliyor...",
  "applyToEditor": "Editore Uygula",
  "noDataSourceWarning": "Once bir veri kaynagi secin.",
  "explainDescription": "Editordeki mevcut SQL sorgusunu Turkce ve Ingilizce olarak aciklar.",
  "explainButton": "Sorguyu Acikla",
  "explaining": "Aciklaniyor...",
  "fixErrorLabel": "Veritabani hata mesaji",
  "fixErrorPlaceholder": "orn. 'FORM' sozcugu yakininda yanlis sozdizimi.",
  "fixButton": "Sorguyu Duzelt",
  "fixing": "Duzeltiliyor..."
}
```

---

### STEP-27: apps/api/src/modules/ai/ai.service.spec.ts (Birim Test)

**Olusturulacak dosya:** `apps/api/src/modules/ai/ai.service.spec.ts`

**Bagimliliklar:** STEP-15

```typescript
import type { AiClient, AiStreamChunk, AiTextResponse } from '@datascriba/ai-client'
import type { ColumnMeta, TableMeta } from '@datascriba/shared-types'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DataSourceService } from '../data-source/data-source.service'
import { AiService } from './ai.service'

// AiClient mock — gercek API cagrisi yapilmaz
const mockSuggestQuery = vi.fn()
const mockExplainQuery = vi.fn()
const mockFixQuery = vi.fn()

vi.mock('@datascriba/ai-client', () => ({
  AiClient: vi.fn().mockImplementation(() => ({
    suggestQuery: mockSuggestQuery,
    explainQuery: mockExplainQuery,
    fixQuery: mockFixQuery,
  })),
}))

const MOCK_TABLES: TableMeta[] = [
  { schema: 'dbo', name: 'Orders', type: 'table' },
]

const MOCK_COLUMNS: ColumnMeta[] = [
  { name: 'Id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
  { name: 'Total', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
]

function makeDataSourceService(): DataSourceService {
  return {
    listTables: vi.fn().mockResolvedValue(MOCK_TABLES),
    describeTable: vi.fn().mockResolvedValue(MOCK_COLUMNS),
  } as unknown as DataSourceService
}

function makeConfigService(): ConfigService {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'ANTHROPIC_API_KEY') return 'test-key'
      if (key === 'AI_MODEL') return 'claude-sonnet-4-6'
      return undefined
    }),
  } as unknown as ConfigService
}

describe('AiService', () => {
  let service: AiService
  let dataSourceService: DataSourceService

  beforeEach(() => {
    vi.clearAllMocks()
    dataSourceService = makeDataSourceService()
    service = new AiService(makeConfigService(), dataSourceService)
    service.onModuleInit()
  })

  describe('suggestQuery', () => {
    it('yields stream chunks from AiClient.suggestQuery', async () => {
      const chunks: AiStreamChunk[] = [
        { type: 'delta', text: 'SELECT' },
        { type: 'delta', text: ' * FROM [dbo].[Orders]' },
        { type: 'done' },
      ]
      mockSuggestQuery.mockImplementation(async function* () {
        for (const c of chunks) yield c
      })

      const result: AiStreamChunk[] = []
      for await (const chunk of service.suggestQuery({
        prompt: 'show all orders',
        dataSourceId: 'ds-1',
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
      expect(dataSourceService.listTables).toHaveBeenCalledWith('ds-1')
      expect(dataSourceService.describeTable).toHaveBeenCalledWith('ds-1', 'dbo.Orders')
    })
  })

  describe('explainQuery', () => {
    it('parses ---TR--- and ---EN--- sections', async () => {
      const mockResponse: AiTextResponse = {
        text: '---TR---\nBu sorgu tum siparisleri dondurur.\n---EN---\nThis query returns all orders.',
        model: 'claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 80,
        cacheReadInputTokens: 0,
      }
      mockExplainQuery.mockResolvedValue(mockResponse)

      const result = await service.explainQuery({ sql: 'SELECT * FROM [dbo].[Orders]' })

      expect(result.turkish).toBe('Bu sorgu tum siparisleri dondurur.')
      expect(result.english).toBe('This query returns all orders.')
      expect(result.model).toBe('claude-sonnet-4-6')
    })

    it('uses full text as turkish if sections are missing', async () => {
      const mockResponse: AiTextResponse = {
        text: 'Plain explanation without sections.',
        model: 'claude-sonnet-4-6',
        inputTokens: 10,
        outputTokens: 5,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      }
      mockExplainQuery.mockResolvedValue(mockResponse)

      const result = await service.explainQuery({ sql: 'SELECT 1' })

      expect(result.turkish).toBe('Plain explanation without sections.')
      expect(result.english).toBe('')
    })
  })

  describe('fixQuery', () => {
    it('yields stream chunks from AiClient.fixQuery', async () => {
      const chunks: AiStreamChunk[] = [
        { type: 'delta', text: 'SELECT * FROM [dbo].[Orders]' },
        { type: 'done' },
      ]
      mockFixQuery.mockImplementation(async function* () {
        for (const c of chunks) yield c
      })

      const result: AiStreamChunk[] = []
      for await (const chunk of service.fixQuery({
        sql: 'SELECT * FORM Orders',
        errorMessage: "Incorrect syntax near 'FORM'.",
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
    })
  })
})
```

---

### STEP-28: .env.example Guncellemesi

**Guncellenecek dosya:** `.env.example`

**Bagimliliklar:** STEP-10

Builder mevcut `.env.example` dosyasini okuyup sonuna su blogu ekler:

```bash
# Scriba AI (Phase 5)
# Anthropic API key -- https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...

# Claude model -- default: claude-sonnet-4-6
AI_MODEL=claude-sonnet-4-6

# AI endpoint rate limit (requests per minute per IP)
AI_RATE_LIMIT_RPM=10
```

---

## Implementasyon Sirasi (Builder icin)

Builder adimlari kesinlikle bu siraya gore uygular:

```
1.  STEP-01  packages/ai-client/package.json + tsconfig.json
2.  STEP-02  packages/ai-client/src/types.ts
3.  STEP-03  packages/ai-client/src/prompts/suggest-query.ts
4.  STEP-04  packages/ai-client/src/prompts/explain-query.ts
5.  STEP-05  packages/ai-client/src/prompts/fix-query.ts
6.  STEP-06  packages/ai-client/src/client.ts
7.  STEP-07  packages/ai-client/src/index.ts
8.  STEP-08  packages/shared-types/src/ai.ts
9.  STEP-09  packages/shared-types/src/index.ts (ai export ekle)
10. STEP-10  apps/api/src/config/env.ts
11. STEP-11  apps/api/package.json
12. [pnpm install -- kok dizinde]
13. STEP-12  apps/api/src/modules/ai/dto/suggest-query.dto.ts
14. STEP-13  apps/api/src/modules/ai/dto/explain-query.dto.ts
15. STEP-14  apps/api/src/modules/ai/dto/fix-query.dto.ts
16. STEP-15  apps/api/src/modules/ai/ai.service.ts
17. STEP-16  apps/api/src/modules/ai/ai.controller.ts
18. STEP-17  apps/api/src/modules/ai/ai.module.ts
19. STEP-18  apps/api/src/app.module.ts
20. STEP-19  apps/api/src/common/filters/app-exception.filter.ts
21. STEP-20  apps/web/package.json
22. [pnpm install -- kok dizinde]
23. STEP-21  apps/web/src/components/ui/collapsible.tsx
24. STEP-22  apps/web/src/components/ui/tabs.tsx
25. STEP-23  apps/web/src/hooks/use-ai.ts
26. STEP-24  apps/web/src/components/ai/ai-assistant-panel.tsx
27. STEP-25  apps/web/src/app/[locale]/reports/[id]/edit/report-editor-client.tsx
28. STEP-26  i18n/messages/en.json + tr.json
29. STEP-27  apps/api/src/modules/ai/ai.service.spec.ts
30. STEP-28  .env.example
31. [pnpm type-check]
32. [pnpm test -- filter api]
```

---

## Test Etme Kilavuzu (Tester icin)

### Birim Testler
```bash
pnpm --filter=@datascriba/api test
# Beklenen: ai.service.spec.ts 3 describe / 4 test gecer
```

### Type Check
```bash
pnpm type-check
# Beklenen: 0 hata
```

### Manuel Test (dev ortami)
1. `.env.local`'a `ANTHROPIC_API_KEY` yaz
2. `pnpm dev --filter=api` ile API'yi baslt
3. `http://localhost:3001/api/docs` Swagger'dan AI endpoint'lerini test et
4. `pnpm dev --filter=web` ile web'i baslt
5. Rapor editorune git, sagdaki dar cubuktan AI panelini ac
6. "SQL Oner" sekmesi: prompt yaz, "SQL Uret" tikla, streaming izle
7. "Acikla" sekmesi: "Sorguyu Acikla" tikla, TR/EN aciklama gor
8. "Duzelt" sekmesi: hata mesaji gir, "Sorguyu Duzelt" tikla

### Rate Limit Testi
```bash
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3001/api/v1/ai/explain-query \
    -H "Content-Type: application/json" \
    -d '{"sql":"SELECT 1"}'
done
# 11. istek 429 donmeli
```

---

## Mimari Notlar

### Neden `@Sse()` + `POST` birlikte?
SSE teknik olarak `GET` metodunu bekler, ancak NestJS `@Sse()` herhangi bir HTTP metoduna uygulanabilir. Prompt body'de tasindigi icin `POST` zorunludur. Fastify adaptoru bu kombinasyonu destekler.

### Neden `AsyncIterable` -> `Observable` donusumu?
NestJS SSE `Observable<MessageEvent>` doner, `AiClient` ise `AsyncIterable<AiStreamChunk>` doner. RxJS `from()` operatoru bu donusumu gerceklestirir.

### Neden `cache_control` icin `@ts-expect-error`?
`@anthropic-ai/sdk` TypeScript tanimlari `cache_control` field'ini her durumda expose etmeyebilir. Builder SDK versiyonunu kontrol etmeli; eger SDK tipi zaten dogruysa `@ts-expect-error` kaldirilmali.

### Neden tum semay prompt'a gonderiyoruz?
MSSQL'de tablo sayisi genellikle onlarla sinirlidir. Tum semay gondermek hem dogruluk hem kolaylik saglar. Buyuk semalarda (500+ tablo) kullanicidan tablo secimi alternatif olabilir -- bu Faz 6'ya birakilir.

### Collapsible Panel Yerlesimi
`report-editor-client.tsx` `flex` layout'a gecer. AI paneli `w-80` sabit genislige sahip, ana editor `flex-1`. Panel kapaliiken `w-7` serit gorunur.

---

## Checklist (Reviewer icin)

- [ ] `packages/ai-client/` paket yapisi olusturulmus
- [ ] `AiClient` Anthropic SDK wraps, prompt caching var
- [ ] 3 prompt dosyasi (`suggest-query`, `explain-query`, `fix-query`) ayri
- [ ] `AiService.buildSchemaContext()` DataSourceService reuse ediyor
- [ ] `AiController` 2x `@Sse()` + 1x `@Post()` endpoint
- [ ] `ThrottlerModule` `AppModule`'de global, `@UseGuards(ThrottlerGuard)` AI controller'da
- [ ] `AI_RATE_LIMIT_RPM` env'den aliniyor (hardcode yok)
- [ ] `AI_MODEL` env'den aliniyor (hardcode yok)
- [ ] `AppExceptionFilter` ThrottlerException -> 429 doniyor
- [ ] `AiAssistantPanel` 3 sekme, collapsible, streaming gosterim
- [ ] "Uygula" butonu `onApplySql` callback cairiyor
- [ ] `use-ai.ts` SSE stream dogru parse ediyor
- [ ] i18n `ai` namespace hem EN hem TR'de var
- [ ] `any` yok, `console.log` yok
- [ ] `ai.service.spec.ts` 4 test var, mock'lar gercek API cagrisi yapmiyor
- [ ] `.env.example` guncellendi
