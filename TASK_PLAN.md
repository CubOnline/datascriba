# TASK_PLAN.md — Phase 2: Veri Kaynağı Yönetimi

**Agent:** builder
**Phase:** 2
**Effort:** L (~1-2 weeks)
**Created by:** planner
**Date:** 2026-05-12

---

## Context

- **Working directory (monorepo root):** `C:\Users\Cub\datascriba\Projects\datascriba`
- **Platform:** Windows 11, PowerShell
- **Package manager:** pnpm 9.15.4
- **Stack:** Turborepo 2.x + NestJS 10 + Fastify + Vitest + TypeScript 5.5 strict
- **Phase 1 completed:** Monorepo scaffold + NestJS skeleton with health endpoint at `/health`
- **Phase 1 fixes required (apply first):** Export `HealthResponse` from `app.service.ts` and import in `app.controller.ts`; remove undocumented `dot-notation: off` from `apps/api/.eslintrc.js`

### Key Architectural Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Driver package location | `packages/db-drivers` | Reusable across future worker and mobile-api; clean separation |
| Encryption helper location | `packages/db-drivers/src/crypto.ts` | Crypto belongs to the driver layer; API imports it via the package |
| Prisma repository stub | In-memory `Map` | No DB migration tooling needed in Phase 2; Phase 3 wires real Prisma |
| DTO validation | Zod schemas (via `class-validator` decorators calling Zod) — actually: use `class-validator` + `@nestjs/swagger` decorators on DTOs for HTTP layer, Zod for env parsing only | Matches CLAUDE.md: "Zod for external input" means env; DTOs use class-validator (already installed Phase 1) |
| Error hierarchy | `DataSourceError` base → `ConnectionError`, `QueryError`, `EncryptionError`, `UnsupportedDriverError` | Typed domain errors, caught by global filter |
| SQL blocking | `QueryGuard` utility in `packages/db-drivers/src/query-guard.ts` | Reusable, testable in isolation |
| Schema introspection cache | In-memory `Map<string, TableMeta[]>` with TTL | Redis deferred to Phase 6 as stated in scope |
| PostgreSQL driver npm package | `pg@8.13.x` + `@types/pg` | Stable LTS, broad ecosystem |
| MySQL driver npm package | `mysql2@3.12.x` | Supports promises natively, TypeScript types included |
| MSSQL driver npm package | `mssql@11.0.x` + `@types/mssql` | Latest stable, pools built-in |
| SQLite driver npm package | `better-sqlite3@11.x` + `@types/better-sqlite3` | Synchronous API wrapped in async adapter |
| Connection pool | One pool per `DataSource.id`, stored in `DriverPoolManager` singleton | Avoids re-connecting on every request |

---

## Prerequisites Verification

Before starting:
1. `node --version` returns `v22.x.x`
2. Working directory is `C:\Users\Cub\datascriba\Projects\datascriba`
3. Phase 1 is complete — `GET http://localhost:3001/health` returns `{ status: 'ok' }`
4. Apply Phase 1 review fixes (see Context above) before continuing

---

## Steps

### Step 0 — Apply Phase 1 review fixes

**File to modify:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\app.service.ts`

Replace entire file content with:

```ts
import { Injectable } from '@nestjs/common'

export interface HealthResponse {
  status: 'ok'
  timestamp: string
  version: string
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    }
  }
}
```

**File to modify:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\app.controller.ts`

Replace entire file content with:

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AppService, HealthResponse } from './app.service'

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '0.1.0' },
      },
    },
  })
  getHealth(): HealthResponse {
    return this.appService.getHealth()
  }
}
```

**File to modify:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\.eslintrc.js`

Replace entire file content with:

```js
// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@datascriba/eslint-config/nestjs'],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
}
```

Verify fix:

```powershell
pnpm --filter=@datascriba/api run test
```

Expected: 3 tests pass.

---

### Step 1 — Install new dependencies

#### 1a — Add `@datascriba/shared-types` to api dependencies

```powershell
pnpm --filter=@datascriba/api add @datascriba/shared-types@workspace:*
```

#### 1b — Install driver packages into `packages/db-drivers` (created in Step 2)

Run after Step 2's `package.json` is created:

```powershell
pnpm --filter=@datascriba/db-drivers add pg@8.13.3 mysql2@3.12.0 mssql@11.0.1 better-sqlite3@11.9.1
pnpm --filter=@datascriba/db-drivers add --save-dev @types/pg@8.11.11 @types/mssql@9.1.5 @types/better-sqlite3@7.6.13 @types/node@22.10.7 typescript@5.5.4 vitest@2.1.9 @vitest/coverage-v8@2.1.9 unplugin-swc@1.5.9 @swc/core@1.15.33
```

#### 1c — Install Pino logging and Prisma into api

```powershell
pnpm --filter=@datascriba/api add nestjs-pino@4.1.0 pino-http@10.4.0 pino@9.6.0
pnpm --filter=@datascriba/api add @prisma/client@6.2.1
pnpm --filter=@datascriba/api add --save-dev prisma@6.2.1
pnpm --filter=@datascriba/db-drivers add @datascriba/shared-types@workspace:*
```

---

### Step 2 — Create `packages/db-drivers/package.json`

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\package.json`

```json
{
  "name": "@datascriba/db-drivers",
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
    "@datascriba/shared-types": "workspace:*",
    "pg": "8.13.3",
    "mysql2": "3.12.0",
    "mssql": "11.0.1",
    "better-sqlite3": "11.9.1"
  },
  "devDependencies": {
    "@datascriba/eslint-config": "workspace:*",
    "@datascriba/tsconfig": "workspace:*",
    "@swc/core": "^1.15.33",
    "@types/better-sqlite3": "^7.6.13",
    "@types/mssql": "^9.1.5",
    "@types/node": "^22.10.7",
    "@types/pg": "^8.11.11",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

---

### Step 3 — Create `packages/db-drivers/tsconfig.json`

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "verbatimModuleSyntax": false,
    "isolatedModules": false,
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

### Step 4 — Create `packages/db-drivers/vitest.config.ts`

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\vitest.config.ts`

```ts
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'node_modules/**', '**/*.spec.ts'],
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: false,
        },
        target: 'es2022',
      },
    }),
  ],
})
```

---

### Step 5 — Create shared types for data sources in `packages/shared-types`

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\shared-types\src\data-source.ts`

```ts
export type DataSourceType = 'postgresql' | 'mysql' | 'mssql' | 'sqlite'

export interface TableMeta {
  schema: string
  name: string
  type: 'table' | 'view'
}

export interface ColumnMeta {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey: boolean
  defaultValue: string | null
}

export interface Row {
  [column: string]: unknown
}

export interface QueryResult {
  columns: ColumnMeta[]
  rows: Row[]
  rowCount: number
  durationMs: number
}

export interface DataSourceRecord {
  id: string
  workspaceId: string
  name: string
  type: DataSourceType
  encryptedConnectionString: string
  createdAt: Date
  updatedAt: Date
}
```

**File (modified):** `C:\Users\Cub\datascriba\Projects\datascriba\packages\shared-types\src\index.ts`

Replace with:

```ts
export type { ApiResponse, PaginatedResponse } from './common'
export type {
  DataSourceType,
  TableMeta,
  ColumnMeta,
  Row,
  QueryResult,
  DataSourceRecord,
} from './data-source'
```

---

### Step 6 — Create the driver abstraction interface and error hierarchy

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\types.ts`

```ts
import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

export interface DataSourceDriver {
  test(): Promise<boolean>
  listTables(): Promise<TableMeta[]>
  describeTable(name: string): Promise<ColumnMeta[]>
  execute(sql: string, params: unknown[]): Promise<QueryResult>
  streamExecute(sql: string, params: unknown[]): AsyncIterable<Row>
  close(): Promise<void>
}

export interface DriverConnectionOptions {
  connectionString: string
  queryTimeoutMs?: number
  allowMutations?: boolean
}
```

---

### Step 7 — Create the error hierarchy

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\errors.ts`

```ts
export class DataSourceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'DataSourceError'
    if (cause instanceof Error) {
      this.stack = `${this.stack ?? ''}\nCaused by: ${cause.stack ?? cause.message}`
    }
  }
}

export class ConnectionError extends DataSourceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'ConnectionError'
  }
}

export class QueryError extends DataSourceError {
  constructor(
    message: string,
    public readonly sql: string,
    cause?: unknown,
  ) {
    super(message, cause)
    this.name = 'QueryError'
  }
}

export class QueryTimeoutError extends QueryError {
  constructor(sql: string, timeoutMs: number) {
    super(`Query exceeded timeout of ${timeoutMs}ms`, sql)
    this.name = 'QueryTimeoutError'
  }
}

export class QueryBlockedError extends QueryError {
  constructor(sql: string, reason: string) {
    super(`Query blocked: ${reason}`, sql)
    this.name = 'QueryBlockedError'
  }
}

export class EncryptionError extends DataSourceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'EncryptionError'
  }
}

export class UnsupportedDriverError extends DataSourceError {
  constructor(driverType: string) {
    super(`Driver type '${driverType}' is not supported`)
    this.name = 'UnsupportedDriverError'
  }
}
```

---

### Step 8 — Create the SQL query guard (blocking dangerous statements)

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\query-guard.ts`

```ts
import { QueryBlockedError } from './errors'

const BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*DROP\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*DELETE\s+FROM\s+/i,
  /;\s*DROP\s+/i,
  /;\s*TRUNCATE\s+/i,
  /;\s*DELETE\s+FROM\s+/i,
]

/**
 * Validates that the SQL statement does not contain blocked operations.
 * Only called when `allowMutations` is false (the default).
 * @throws {QueryBlockedError} if a blocked pattern is matched
 */
export function assertQueryAllowed(sql: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      throw new QueryBlockedError(sql, `matches blocked pattern: ${pattern.toString()}`)
    }
  }
}

/**
 * Validates that params array is provided and SQL uses placeholders.
 * This is a soft guard — drivers always use parameterized queries at the
 * protocol level; this check catches obviously wrong usage at the call site.
 * @throws {QueryBlockedError} if SQL contains raw concat patterns
 */
export function assertParameterized(sql: string, params: unknown[]): void {
  // Detect string concatenation attempts in the SQL itself (not in params)
  const RAW_CONCAT = /'\s*\+\s*'|"\s*\+\s*"/
  if (RAW_CONCAT.test(sql)) {
    throw new QueryBlockedError(sql, 'SQL contains raw string concatenation — use params array')
  }
  // Warn: no placeholders but params provided (mismatch)
  const hasPlaceholders = /\$\d+|\?|@[a-zA-Z_]\w*/.test(sql)
  if (params.length > 0 && !hasPlaceholders) {
    throw new QueryBlockedError(sql, 'params provided but SQL has no placeholders')
  }
}
```

---

### Step 9 — Create the AES-256-GCM encryption helper

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\crypto.ts`

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { EncryptionError } from './errors'

const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: `iv_hex:authTag_hex:ciphertext_hex` (all hex-encoded).
 *
 * @param plaintext - The connection string (or any secret) to encrypt
 * @param masterKeyHex - 64-character hex string representing a 32-byte key
 */
export function encrypt(plaintext: string, masterKeyHex: string): string {
  try {
    const key = Buffer.from(masterKeyHex, 'hex')
    if (key.length !== 32) {
      throw new EncryptionError('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)')
    }
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
  } catch (error) {
    if (error instanceof EncryptionError) throw error
    throw new EncryptionError('Encryption failed', error)
  }
}

/**
 * Decrypts a ciphertext string produced by `encrypt`.
 *
 * @param ciphertext - The `iv_hex:authTag_hex:ciphertext_hex` string
 * @param masterKeyHex - 64-character hex string representing a 32-byte key
 */
export function decrypt(ciphertext: string, masterKeyHex: string): string {
  try {
    const key = Buffer.from(masterKeyHex, 'hex')
    if (key.length !== 32) {
      throw new EncryptionError('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)')
    }
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new EncryptionError('Invalid ciphertext format — expected iv:authTag:data')
    }
    const [ivHex, authTagHex, dataHex] = parts as [string, string, string]
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return decipher.update(data).toString('utf8') + decipher.final('utf8')
  } catch (error) {
    if (error instanceof EncryptionError) throw error
    throw new EncryptionError('Decryption failed — key may be wrong or data corrupted', error)
  }
}
```

---

### Step 10 — Create unit tests for crypto

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\crypto.spec.ts`

```ts
import { describe, it, expect } from 'vitest'

import { decrypt, encrypt } from './crypto'
import { EncryptionError } from './errors'

const VALID_KEY = 'a'.repeat(64) // 32 bytes of 0xaa

describe('encrypt / decrypt', () => {
  it('round-trips a connection string', () => {
    const original = 'postgresql://user:secret@localhost:5432/mydb'
    const ciphertext = encrypt(original, VALID_KEY)
    expect(decrypt(ciphertext, VALID_KEY)).toBe(original)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const input = 'same-input'
    const c1 = encrypt(input, VALID_KEY)
    const c2 = encrypt(input, VALID_KEY)
    expect(c1).not.toBe(c2)
  })

  it('throws EncryptionError with wrong key on decrypt', () => {
    const cipher = encrypt('secret', VALID_KEY)
    const wrongKey = 'b'.repeat(64)
    expect(() => decrypt(cipher, wrongKey)).toThrow(EncryptionError)
  })

  it('throws EncryptionError for invalid key length', () => {
    expect(() => encrypt('data', 'tooshort')).toThrow(EncryptionError)
  })

  it('throws EncryptionError for malformed ciphertext', () => {
    expect(() => decrypt('notvalid', VALID_KEY)).toThrow(EncryptionError)
  })
})
```

---

### Step 11 — Create unit tests for query guard

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\query-guard.spec.ts`

```ts
import { describe, it, expect } from 'vitest'

import { QueryBlockedError } from './errors'
import { assertParameterized, assertQueryAllowed } from './query-guard'

describe('assertQueryAllowed', () => {
  it('allows a plain SELECT', () => {
    expect(() => assertQueryAllowed('SELECT id, name FROM users WHERE id = $1')).not.toThrow()
  })

  it('allows INSERT', () => {
    expect(() => assertQueryAllowed('INSERT INTO logs (msg) VALUES ($1)')).not.toThrow()
  })

  it('allows UPDATE', () => {
    expect(() => assertQueryAllowed('UPDATE users SET name = $1 WHERE id = $2')).not.toThrow()
  })

  it('blocks DROP TABLE', () => {
    expect(() => assertQueryAllowed('DROP TABLE users')).toThrow(QueryBlockedError)
  })

  it('blocks TRUNCATE', () => {
    expect(() => assertQueryAllowed('TRUNCATE TABLE orders')).toThrow(QueryBlockedError)
  })

  it('blocks DELETE FROM', () => {
    expect(() => assertQueryAllowed('DELETE FROM sessions')).toThrow(QueryBlockedError)
  })

  it('blocks SQL injection attempt via semicolon', () => {
    expect(() =>
      assertQueryAllowed("SELECT * FROM users WHERE id = 1; DROP TABLE users"),
    ).toThrow(QueryBlockedError)
  })
})

describe('assertParameterized', () => {
  it('passes when params match placeholders', () => {
    expect(() => assertParameterized('SELECT * FROM t WHERE id = $1', [42])).not.toThrow()
  })

  it('passes when no params and no placeholders', () => {
    expect(() => assertParameterized('SELECT 1', [])).not.toThrow()
  })

  it('blocks raw string concatenation pattern', () => {
    expect(() => assertParameterized("SELECT * FROM t WHERE name = '" + "' + userInput + '", [])).toThrow(QueryBlockedError)
  })
})
```

---

### Step 12 — Create the PostgreSQL driver implementation

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\drivers\postgresql.driver.ts`

```ts
import { Pool, PoolConfig } from 'pg'

import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

import { ConnectionError, QueryError, QueryTimeoutError } from '../errors'
import { assertParameterized, assertQueryAllowed } from '../query-guard'
import type { DataSourceDriver, DriverConnectionOptions } from '../types'

export class PostgresqlDriver implements DataSourceDriver {
  private readonly pool: Pool
  private readonly queryTimeoutMs: number
  private readonly allowMutations: boolean

  constructor(options: DriverConnectionOptions) {
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30_000
    this.allowMutations = options.allowMutations ?? false

    const poolConfig: PoolConfig = {
      connectionString: options.connectionString,
      connectionTimeoutMillis: 5_000,
      statement_timeout: this.queryTimeoutMs,
      max: 10,
    }
    this.pool = new Pool(poolConfig)
  }

  async test(): Promise<boolean> {
    const client = await this.pool.connect().catch((err: unknown) => {
      throw new ConnectionError('PostgreSQL connection test failed', err)
    })
    try {
      await client.query('SELECT 1')
      return true
    } catch (err) {
      throw new ConnectionError('PostgreSQL test query failed', err)
    } finally {
      client.release()
    }
  }

  async listTables(): Promise<TableMeta[]> {
    const sql = `
      SELECT table_schema AS "schema", table_name AS "name",
        CASE table_type WHEN 'VIEW' THEN 'view' ELSE 'table' END AS "type"
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `
    const result = await this.pool.query<{ schema: string; name: string; type: 'table' | 'view' }>(sql)
    return result.rows.map((r) => ({
      schema: r.schema,
      name: r.name,
      type: r.type,
    }))
  }

  async describeTable(name: string): Promise<ColumnMeta[]> {
    const [schema, table] = name.includes('.') ? name.split('.', 2) as [string, string] : ['public', name]
    const sql = `
      SELECT
        c.column_name AS "name",
        c.data_type AS "dataType",
        c.is_nullable = 'YES' AS "nullable",
        COALESCE(
          (SELECT true FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND kcu.table_schema = $1
             AND kcu.table_name = $2
             AND kcu.column_name = c.column_name
           LIMIT 1),
          false
        ) AS "isPrimaryKey",
        c.column_default AS "defaultValue"
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `
    const result = await this.pool.query<ColumnMeta>(sql, [schema, table])
    return result.rows
  }

  async execute(sql: string, params: unknown[]): Promise<QueryResult> {
    if (!this.allowMutations) {
      assertQueryAllowed(sql)
    }
    assertParameterized(sql, params)

    const start = Date.now()
    const timer = setTimeout(() => {
      throw new QueryTimeoutError(sql, this.queryTimeoutMs)
    }, this.queryTimeoutMs)

    try {
      const result = await this.pool.query(sql, params)
      clearTimeout(timer)
      const durationMs = Date.now() - start
      const columns: ColumnMeta[] = (result.fields ?? []).map((f) => ({
        name: f.name,
        dataType: String(f.dataTypeID),
        nullable: true,
        isPrimaryKey: false,
        defaultValue: null,
      }))
      return {
        columns,
        rows: result.rows as Row[],
        rowCount: result.rowCount ?? 0,
        durationMs,
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof QueryTimeoutError) throw err
      throw new QueryError(`PostgreSQL query failed`, sql, err)
    }
  }

  async *streamExecute(sql: string, params: unknown[]): AsyncIterable<Row> {
    if (!this.allowMutations) {
      assertQueryAllowed(sql)
    }
    assertParameterized(sql, params)

    const client = await this.pool.connect()
    try {
      const result = await client.query(sql, params)
      for (const row of result.rows as Row[]) {
        yield row
      }
    } catch (err) {
      throw new QueryError('PostgreSQL stream query failed', sql, err)
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
```

---

### Step 13 — Create the MySQL driver implementation

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\drivers\mysql.driver.ts`

```ts
import mysql2 from 'mysql2/promise'

import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

import { ConnectionError, QueryError, QueryTimeoutError } from '../errors'
import { assertParameterized, assertQueryAllowed } from '../query-guard'
import type { DataSourceDriver, DriverConnectionOptions } from '../types'

export class MysqlDriver implements DataSourceDriver {
  private pool: mysql2.Pool
  private readonly queryTimeoutMs: number
  private readonly allowMutations: boolean

  constructor(options: DriverConnectionOptions) {
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30_000
    this.allowMutations = options.allowMutations ?? false
    this.pool = mysql2.createPool({
      uri: options.connectionString,
      connectTimeout: 5_000,
      connectionLimit: 10,
    })
  }

  async test(): Promise<boolean> {
    const conn = await this.pool.getConnection().catch((err: unknown) => {
      throw new ConnectionError('MySQL connection test failed', err)
    })
    try {
      await conn.query('SELECT 1')
      return true
    } catch (err) {
      throw new ConnectionError('MySQL test query failed', err)
    } finally {
      conn.release()
    }
  }

  async listTables(): Promise<TableMeta[]> {
    const sql = `
      SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS \`name\`,
        CASE TABLE_TYPE WHEN 'VIEW' THEN 'view' ELSE 'table' END AS \`type\`
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `
    const [rows] = await this.pool.query<mysql2.RowDataPacket[]>(sql)
    return rows.map((r) => ({
      schema: r['schema'] as string,
      name: r['name'] as string,
      type: r['type'] as 'table' | 'view',
    }))
  }

  async describeTable(name: string): Promise<ColumnMeta[]> {
    const parts = name.split('.', 2)
    const [schema, table] = parts.length === 2 ? (parts as [string, string]) : [undefined, name]
    const schemaFilter = schema ? `AND c.TABLE_SCHEMA = ?` : `AND c.TABLE_SCHEMA = DATABASE()`
    const schemaParam: string[] = schema ? [schema] : []
    const sql = `
      SELECT
        c.COLUMN_NAME AS name,
        c.DATA_TYPE AS dataType,
        c.IS_NULLABLE = 'YES' AS nullable,
        c.COLUMN_KEY = 'PRI' AS isPrimaryKey,
        c.COLUMN_DEFAULT AS defaultValue
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_NAME = ? ${schemaFilter}
      ORDER BY c.ORDINAL_POSITION
    `
    const [rows] = await this.pool.query<mysql2.RowDataPacket[]>(sql, [table, ...schemaParam])
    return rows.map((r) => ({
      name: r['name'] as string,
      dataType: r['dataType'] as string,
      nullable: Boolean(r['nullable']),
      isPrimaryKey: Boolean(r['isPrimaryKey']),
      defaultValue: (r['defaultValue'] as string | null) ?? null,
    }))
  }

  async execute(sql: string, params: unknown[]): Promise<QueryResult> {
    if (!this.allowMutations) assertQueryAllowed(sql)
    assertParameterized(sql, params)
    const start = Date.now()
    try {
      const [rows, fields] = await this.pool.query<mysql2.RowDataPacket[]>(sql, params)
      const durationMs = Date.now() - start
      if (durationMs > this.queryTimeoutMs) throw new QueryTimeoutError(sql, this.queryTimeoutMs)
      const columns: ColumnMeta[] = (fields ?? []).map((f) => ({
        name: f.name,
        dataType: String(f.type),
        nullable: true,
        isPrimaryKey: false,
        defaultValue: null,
      }))
      return {
        columns,
        rows: rows as Row[],
        rowCount: rows.length,
        durationMs,
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) throw err
      throw new QueryError('MySQL query failed', sql, err)
    }
  }

  async *streamExecute(sql: string, params: unknown[]): AsyncIterable<Row> {
    if (!this.allowMutations) assertQueryAllowed(sql)
    assertParameterized(sql, params)
    const [rows] = await this.pool.query<mysql2.RowDataPacket[]>(sql, params)
    for (const row of rows) {
      yield row as Row
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
```

---

### Step 14 — Create the MSSQL driver implementation

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\drivers\mssql.driver.ts`

```ts
import mssql from 'mssql'

import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

import { ConnectionError, QueryError, QueryTimeoutError } from '../errors'
import { assertParameterized, assertQueryAllowed } from '../query-guard'
import type { DataSourceDriver, DriverConnectionOptions } from '../types'

export class MssqlDriver implements DataSourceDriver {
  private pool: mssql.ConnectionPool | null = null
  private readonly connectionString: string
  private readonly queryTimeoutMs: number
  private readonly allowMutations: boolean

  constructor(options: DriverConnectionOptions) {
    this.connectionString = options.connectionString
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30_000
    this.allowMutations = options.allowMutations ?? false
  }

  private async getPool(): Promise<mssql.ConnectionPool> {
    if (this.pool?.connected) return this.pool
    try {
      this.pool = await mssql.connect(this.connectionString)
      return this.pool
    } catch (err) {
      throw new ConnectionError('MSSQL connection failed', err)
    }
  }

  async test(): Promise<boolean> {
    const pool = await this.getPool()
    try {
      await pool.request().query('SELECT 1')
      return true
    } catch (err) {
      throw new ConnectionError('MSSQL test query failed', err)
    }
  }

  async listTables(): Promise<TableMeta[]> {
    const pool = await this.getPool()
    const result = await pool.request().query<{ schema: string; name: string; type: 'table' | 'view' }>(`
      SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [name],
        CASE TABLE_TYPE WHEN 'VIEW' THEN 'view' ELSE 'table' END AS [type]
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    return result.recordset.map((r) => ({
      schema: r.schema,
      name: r.name,
      type: r.type,
    }))
  }

  async describeTable(name: string): Promise<ColumnMeta[]> {
    const parts = name.split('.', 2)
    const [schema, table] = parts.length === 2 ? (parts as [string, string]) : ['dbo', name]
    const pool = await this.getPool()
    const result = await pool
      .request()
      .input('schema', mssql.VarChar, schema)
      .input('table', mssql.VarChar, table)
      .query<ColumnMeta>(`
        SELECT
          c.COLUMN_NAME AS name,
          c.DATA_TYPE AS dataType,
          CAST(CASE c.IS_NULLABLE WHEN 'YES' THEN 1 ELSE 0 END AS BIT) AS nullable,
          CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS isPrimaryKey,
          c.COLUMN_DEFAULT AS defaultValue
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_SCHEMA = @schema AND tc.TABLE_NAME = @table
        ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
        ORDER BY c.ORDINAL_POSITION
      `)
    return result.recordset
  }

  async execute(sql: string, params: unknown[]): Promise<QueryResult> {
    if (!this.allowMutations) assertQueryAllowed(sql)
    assertParameterized(sql, params)
    const pool = await this.getPool()
    const request = pool.request()
    request.timeout = this.queryTimeoutMs
    params.forEach((p, i) => {
      request.input(`p${i + 1}`, p)
    })
    const start = Date.now()
    try {
      const result = await request.query(sql)
      const durationMs = Date.now() - start
      if (durationMs > this.queryTimeoutMs) throw new QueryTimeoutError(sql, this.queryTimeoutMs)
      const columns: ColumnMeta[] = result.recordset.columns
        ? Object.keys(result.recordset.columns).map((colName) => ({
            name: colName,
            dataType: String(result.recordset.columns[colName]?.type ?? 'unknown'),
            nullable: result.recordset.columns[colName]?.nullable ?? true,
            isPrimaryKey: false,
            defaultValue: null,
          }))
        : []
      return {
        columns,
        rows: result.recordset as Row[],
        rowCount: result.rowsAffected.reduce((a, b) => a + b, 0),
        durationMs,
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) throw err
      throw new QueryError('MSSQL query failed', sql, err)
    }
  }

  async *streamExecute(sql: string, params: unknown[]): AsyncIterable<Row> {
    const result = await this.execute(sql, params)
    for (const row of result.rows) {
      yield row
    }
  }

  async close(): Promise<void> {
    await this.pool?.close()
    this.pool = null
  }
}
```

---

### Step 15 — Create the SQLite driver implementation

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\drivers\sqlite.driver.ts`

```ts
import BetterSqlite3 from 'better-sqlite3'

import type { ColumnMeta, QueryResult, Row, TableMeta } from '@datascriba/shared-types'

import { ConnectionError, QueryError, QueryTimeoutError } from '../errors'
import { assertParameterized, assertQueryAllowed } from '../query-guard'
import type { DataSourceDriver, DriverConnectionOptions } from '../types'

export class SqliteDriver implements DataSourceDriver {
  private db: BetterSqlite3.Database | null = null
  private readonly filePath: string
  private readonly queryTimeoutMs: number
  private readonly allowMutations: boolean

  constructor(options: DriverConnectionOptions) {
    // connectionString for SQLite is a file path or ':memory:'
    this.filePath = options.connectionString.replace(/^sqlite:\/\//, '')
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30_000
    this.allowMutations = options.allowMutations ?? false
  }

  private getDb(): BetterSqlite3.Database {
    if (!this.db) {
      try {
        this.db = new BetterSqlite3(this.filePath, { timeout: this.queryTimeoutMs })
      } catch (err) {
        throw new ConnectionError(`SQLite failed to open: ${this.filePath}`, err)
      }
    }
    return this.db
  }

  async test(): Promise<boolean> {
    try {
      this.getDb().prepare('SELECT 1').get()
      return true
    } catch (err) {
      throw new ConnectionError('SQLite test query failed', err)
    }
  }

  async listTables(): Promise<TableMeta[]> {
    const rows = this.getDb()
      .prepare<[], { name: string; type: string }>(
        `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`,
      )
      .all()
    return rows.map((r) => ({
      schema: 'main',
      name: r.name,
      type: r.type === 'view' ? 'view' : 'table',
    }))
  }

  async describeTable(name: string): Promise<ColumnMeta[]> {
    const rows = this.getDb()
      .prepare<[string], { name: string; type: string; notnull: number; pk: number; dflt_value: string | null }>(
        `PRAGMA table_info(?)`,
      )
      .all(name)
    return rows.map((r) => ({
      name: r.name,
      dataType: r.type,
      nullable: r.notnull === 0,
      isPrimaryKey: r.pk > 0,
      defaultValue: r.dflt_value,
    }))
  }

  async execute(sql: string, params: unknown[]): Promise<QueryResult> {
    if (!this.allowMutations) assertQueryAllowed(sql)
    assertParameterized(sql, params)
    const start = Date.now()
    try {
      const stmt = this.getDb().prepare(sql)
      const rows = stmt.all(...params) as Row[]
      const durationMs = Date.now() - start
      if (durationMs > this.queryTimeoutMs) throw new QueryTimeoutError(sql, this.queryTimeoutMs)
      return {
        columns: [],
        rows,
        rowCount: rows.length,
        durationMs,
      }
    } catch (err) {
      if (err instanceof QueryTimeoutError) throw err
      throw new QueryError('SQLite query failed', sql, err)
    }
  }

  async *streamExecute(sql: string, params: unknown[]): AsyncIterable<Row> {
    const result = await this.execute(sql, params)
    for (const row of result.rows) {
      yield row
    }
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }
}
```

---

### Step 16 — Create the driver factory and pool manager

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\driver-factory.ts`

```ts
import type { DataSourceType } from '@datascriba/shared-types'

import { MssqlDriver } from './drivers/mssql.driver'
import { MysqlDriver } from './drivers/mysql.driver'
import { PostgresqlDriver } from './drivers/postgresql.driver'
import { SqliteDriver } from './drivers/sqlite.driver'
import { UnsupportedDriverError } from './errors'
import type { DataSourceDriver, DriverConnectionOptions } from './types'

export function createDriver(
  type: DataSourceType,
  options: DriverConnectionOptions,
): DataSourceDriver {
  switch (type) {
    case 'postgresql':
      return new PostgresqlDriver(options)
    case 'mysql':
      return new MysqlDriver(options)
    case 'mssql':
      return new MssqlDriver(options)
    case 'sqlite':
      return new SqliteDriver(options)
    default: {
      const exhaustive: never = type
      throw new UnsupportedDriverError(exhaustive)
    }
  }
}
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\pool-manager.ts`

```ts
import type { DataSourceType } from '@datascriba/shared-types'

import { createDriver } from './driver-factory'
import type { DataSourceDriver, DriverConnectionOptions } from './types'

interface PoolEntry {
  driver: DataSourceDriver
  lastUsed: number
}

/**
 * Manages one driver instance (connection pool) per DataSource ID.
 * The pool entry is created lazily and reused across requests.
 * Call `release(id)` when a DataSource is deleted.
 * Call `releaseAll()` during application shutdown.
 */
export class DriverPoolManager {
  private readonly pools = new Map<string, PoolEntry>()

  getOrCreate(
    dataSourceId: string,
    type: DataSourceType,
    options: DriverConnectionOptions,
  ): DataSourceDriver {
    const existing = this.pools.get(dataSourceId)
    if (existing) {
      existing.lastUsed = Date.now()
      return existing.driver
    }
    const driver = createDriver(type, options)
    this.pools.set(dataSourceId, { driver, lastUsed: Date.now() })
    return driver
  }

  async release(dataSourceId: string): Promise<void> {
    const entry = this.pools.get(dataSourceId)
    if (entry) {
      await entry.driver.close()
      this.pools.delete(dataSourceId)
    }
  }

  async releaseAll(): Promise<void> {
    const ids = [...this.pools.keys()]
    await Promise.all(ids.map((id) => this.release(id)))
  }
}
```

---

### Step 17 — Create the schema introspection cache

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\schema-cache.ts`

```ts
import type { TableMeta } from '@datascriba/shared-types'

const DEFAULT_TTL_MS = 5 * 60 * 1_000 // 5 minutes

interface CacheEntry {
  tables: TableMeta[]
  expiresAt: number
}

/**
 * In-memory schema cache keyed by DataSource ID.
 * Phase 6 replaces this with Redis.
 */
export class SchemaCache {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  get(dataSourceId: string): TableMeta[] | null {
    const entry = this.cache.get(dataSourceId)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(dataSourceId)
      return null
    }
    return entry.tables
  }

  set(dataSourceId: string, tables: TableMeta[]): void {
    this.cache.set(dataSourceId, {
      tables,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  invalidate(dataSourceId: string): void {
    this.cache.delete(dataSourceId)
  }

  invalidateAll(): void {
    this.cache.clear()
  }
}
```

---

### Step 18 — Create the `packages/db-drivers` index export

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\index.ts`

```ts
export { createDriver } from './driver-factory'
export { DriverPoolManager } from './pool-manager'
export { SchemaCache } from './schema-cache'
export { encrypt, decrypt } from './crypto'
export { assertQueryAllowed, assertParameterized } from './query-guard'
export {
  DataSourceError,
  ConnectionError,
  QueryError,
  QueryTimeoutError,
  QueryBlockedError,
  EncryptionError,
  UnsupportedDriverError,
} from './errors'
export type { DataSourceDriver, DriverConnectionOptions } from './types'
```

---

### Step 19 — Create the Zod env schema with `ENCRYPTION_MASTER_KEY` validation

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\config\env.ts`

```ts
import { z } from 'zod'

const HEX_64 = /^[0-9a-fA-F]{64}$/

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_MASTER_KEY: z
    .string()
    .regex(HEX_64, 'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validates process.env at startup. Throws with a descriptive message if
 * any required variable is missing or malformed. App will refuse to start.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${formatted}`)
  }
  return result.data
}
```

---

### Step 20 — Create the global exception filter

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\common\filters\app-exception.filter.ts`

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'

import {
  ConnectionError,
  DataSourceError,
  QueryBlockedError,
  QueryError,
  QueryTimeoutError,
  UnsupportedDriverError,
} from '@datascriba/db-drivers'

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

    // Log unexpected errors at error level, domain errors at warn
    if (statusCode >= 500) {
      this.logger.error({ err: exception, path: request.url }, message)
    } else {
      this.logger.warn({ path: request.url }, message)
    }

    void reply.status(statusCode).send(body)
  }

  private mapException(exception: unknown): { statusCode: number; message: string } {
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: exception.message }
    }
    if (exception instanceof QueryBlockedError) {
      return { statusCode: HttpStatus.FORBIDDEN, message: exception.message }
    }
    if (exception instanceof QueryTimeoutError) {
      return { statusCode: HttpStatus.REQUEST_TIMEOUT, message: exception.message }
    }
    if (exception instanceof ConnectionError) {
      return { statusCode: HttpStatus.BAD_GATEWAY, message: 'Data source connection failed' }
    }
    if (exception instanceof QueryError) {
      return { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Query execution failed' }
    }
    if (exception instanceof UnsupportedDriverError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: exception.message }
    }
    if (exception instanceof DataSourceError) {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Data source error' }
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }
  }
}
```

---

### Step 21 — Create the DataSource DTOs

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\dto\create-data-source.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

import type { DataSourceType } from '@datascriba/shared-types'

export class CreateDataSourceDto {
  @ApiProperty({ description: 'Human-readable name', example: 'Production DB' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiProperty({
    description: 'Database driver type',
    enum: ['postgresql', 'mysql', 'mssql', 'sqlite'],
    example: 'postgresql',
  })
  @IsEnum(['postgresql', 'mysql', 'mssql', 'sqlite'])
  type!: DataSourceType

  @ApiProperty({
    description: 'Connection string (will be encrypted at rest)',
    example: 'postgresql://user:pass@localhost:5432/mydb',
  })
  @IsString()
  @MinLength(1)
  connectionString!: string

  @ApiPropertyOptional({ description: 'Workspace ID (defaults to authenticated user workspace)' })
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional({ description: 'Query timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  queryTimeoutMs?: number

  @ApiPropertyOptional({
    description: 'Allow mutating statements (DELETE/DROP/TRUNCATE)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMutations?: boolean
}
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\dto\update-data-source.dto.ts`

```ts
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class UpdateDataSourceDto {
  @ApiPropertyOptional({ description: 'Human-readable name', example: 'Staging DB' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: 'New connection string (will be re-encrypted)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  connectionString?: string

  @ApiPropertyOptional({ description: 'Query timeout in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  queryTimeoutMs?: number

  @ApiPropertyOptional({ description: 'Allow mutating statements' })
  @IsOptional()
  @IsBoolean()
  allowMutations?: boolean
}
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\dto\execute-query.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator'

export class ExecuteQueryDto {
  @ApiProperty({ description: 'SQL query with $1/$2 or ? placeholders', example: 'SELECT * FROM users WHERE id = $1' })
  @IsString()
  @MinLength(1)
  sql!: string

  @ApiPropertyOptional({ description: 'Ordered list of parameter values', type: [Object] })
  @IsOptional()
  @IsArray()
  params?: unknown[]
}
```

---

### Step 22 — Create the DataSource repository (in-memory stub)

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.repository.ts`

```ts
import { Injectable } from '@nestjs/common'

import type { DataSourceRecord } from '@datascriba/shared-types'

/**
 * Phase 2 stub: stores DataSource records in-memory.
 * Phase 3 replaces this with a real Prisma implementation.
 * All methods simulate what Prisma would return.
 */
@Injectable()
export class DataSourceRepository {
  private readonly store = new Map<string, DataSourceRecord>()

  async findAll(workspaceId: string): Promise<DataSourceRecord[]> {
    return [...this.store.values()].filter((r) => r.workspaceId === workspaceId)
  }

  async findById(id: string): Promise<DataSourceRecord | null> {
    return this.store.get(id) ?? null
  }

  async create(data: Omit<DataSourceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DataSourceRecord> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: DataSourceRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    data: Partial<Omit<DataSourceRecord, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<DataSourceRecord | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: DataSourceRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}
```

---

### Step 23 — Create the DataSource service

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.service.ts`

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { Logger } from '@nestjs/common'

import {
  decrypt,
  DriverPoolManager,
  encrypt,
  SchemaCache,
} from '@datascriba/db-drivers'
import type { ColumnMeta, DataSourceRecord, QueryResult, TableMeta } from '@datascriba/shared-types'

import { DataSourceRepository } from './data-source.repository'
import type { CreateDataSourceDto } from './dto/create-data-source.dto'
import type { UpdateDataSourceDto } from './dto/update-data-source.dto'

const DEFAULT_WORKSPACE_ID = 'default'

@Injectable()
export class DataSourceService {
  private readonly logger = new Logger(DataSourceService.name)
  private readonly poolManager = new DriverPoolManager()
  private readonly schemaCache = new SchemaCache()

  constructor(private readonly repository: DataSourceRepository) {}

  private getMasterKey(): string {
    const key = process.env['ENCRYPTION_MASTER_KEY']
    if (!key) throw new Error('ENCRYPTION_MASTER_KEY is not set')
    return key
  }

  async create(dto: CreateDataSourceDto): Promise<DataSourceRecord> {
    const encryptedConnectionString = encrypt(dto.connectionString, this.getMasterKey())
    const record = await this.repository.create({
      name: dto.name,
      type: dto.type,
      encryptedConnectionString,
      workspaceId: dto.workspaceId ?? DEFAULT_WORKSPACE_ID,
    })
    this.logger.log({ dataSourceId: record.id, type: record.type }, 'DataSource created')
    return this.sanitize(record)
  }

  async findAll(workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<DataSourceRecord[]> {
    const records = await this.repository.findAll(workspaceId)
    return records.map((r) => this.sanitize(r))
  }

  async findOne(id: string): Promise<DataSourceRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new NotFoundException(`DataSource '${id}' not found`)
    return this.sanitize(record)
  }

  async update(id: string, dto: UpdateDataSourceDto): Promise<DataSourceRecord> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new NotFoundException(`DataSource '${id}' not found`)

    const patch: Partial<DataSourceRecord> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.connectionString !== undefined) {
      patch.encryptedConnectionString = encrypt(dto.connectionString, this.getMasterKey())
    }

    const updated = await this.repository.update(id, patch)
    if (!updated) throw new NotFoundException(`DataSource '${id}' not found`)

    this.logger.log({ dataSourceId: id }, 'DataSource updated')
    // Invalidate cached schema and pool
    this.schemaCache.invalidate(id)
    await this.poolManager.release(id)

    return this.sanitize(updated)
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundException(`DataSource '${id}' not found`)
    this.schemaCache.invalidate(id)
    await this.poolManager.release(id)
    this.logger.log({ dataSourceId: id }, 'DataSource deleted')
  }

  async testConnection(id: string): Promise<boolean> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.test()
  }

  async listTables(id: string): Promise<TableMeta[]> {
    const cached = this.schemaCache.get(id)
    if (cached) return cached
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    const tables = await driver.listTables()
    this.schemaCache.set(id, tables)
    return tables
  }

  async describeTable(id: string, tableName: string): Promise<ColumnMeta[]> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.describeTable(tableName)
  }

  async executeQuery(id: string, sql: string, params: unknown[]): Promise<QueryResult> {
    const record = await this.getRecord(id)
    const driver = this.getDriver(record)
    return driver.execute(sql, params)
  }

  /** Returns record including encrypted string (used internally only). */
  private async getRecord(id: string): Promise<DataSourceRecord> {
    const record = await this.repository.findById(id)
    if (!record) throw new NotFoundException(`DataSource '${id}' not found`)
    return record
  }

  private getDriver(record: DataSourceRecord) {
    const connectionString = decrypt(record.encryptedConnectionString, this.getMasterKey())
    return this.poolManager.getOrCreate(record.id, record.type, {
      connectionString,
      queryTimeoutMs: 30_000,
      allowMutations: false,
    })
  }

  /**
   * Never expose the encrypted connection string over HTTP.
   * Return a sanitized copy.
   */
  private sanitize(record: DataSourceRecord): DataSourceRecord {
    return {
      ...record,
      encryptedConnectionString: '[REDACTED]',
    }
  }
}
```

---

### Step 24 — Create the DataSource controller

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.controller.ts`

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import type { ColumnMeta, DataSourceRecord, QueryResult, TableMeta } from '@datascriba/shared-types'

import { DataSourceService } from './data-source.service'
import { CreateDataSourceDto } from './dto/create-data-source.dto'
import { ExecuteQueryDto } from './dto/execute-query.dto'
import { UpdateDataSourceDto } from './dto/update-data-source.dto'

@ApiTags('Data Sources')
@Controller('data-sources')
export class DataSourceController {
  constructor(private readonly service: DataSourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new data source' })
  @ApiBody({ type: CreateDataSourceDto })
  async create(@Body() dto: CreateDataSourceDto): Promise<DataSourceRecord> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all data sources' })
  async findAll(): Promise<DataSourceRecord[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single data source by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Data source not found' })
  async findOne(@Param('id') id: string): Promise<DataSourceRecord> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a data source' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateDataSourceDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ): Promise<DataSourceRecord> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a data source' })
  @ApiParam({ name: 'id', type: String })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a data source connection' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  async testConnection(@Param('id') id: string): Promise<{ ok: boolean }> {
    const ok = await this.service.testConnection(id)
    return { ok }
  }

  @Get(':id/tables')
  @ApiOperation({ summary: 'List tables in a data source' })
  @ApiParam({ name: 'id', type: String })
  async listTables(@Param('id') id: string): Promise<TableMeta[]> {
    return this.service.listTables(id)
  }

  @Get(':id/tables/:tableName')
  @ApiOperation({ summary: 'Describe columns of a table' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'tableName', type: String })
  async describeTable(
    @Param('id') id: string,
    @Param('tableName') tableName: string,
  ): Promise<ColumnMeta[]> {
    return this.service.describeTable(id, tableName)
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a SQL query against a data source' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ExecuteQueryDto })
  async executeQuery(
    @Param('id') id: string,
    @Body() dto: ExecuteQueryDto,
  ): Promise<QueryResult> {
    return this.service.executeQuery(id, dto.sql, dto.params ?? [])
  }
}
```

---

### Step 25 — Create the DataSource module

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.module.ts`

```ts
import { Module } from '@nestjs/common'

import { DataSourceController } from './data-source.controller'
import { DataSourceRepository } from './data-source.repository'
import { DataSourceService } from './data-source.service'

@Module({
  controllers: [DataSourceController],
  providers: [DataSourceService, DataSourceRepository],
  exports: [DataSourceService],
})
export class DataSourceModule {}
```

---

### Step 26 — Wire DataSourceModule into AppModule and integrate env validation + exception filter

**File (full replacement):** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\app.module.ts`

```ts
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'

import { AppExceptionFilter } from './common/filters/app-exception.filter'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DataSourceModule } from './modules/data-source/data-source.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DataSourceModule,
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

**File (full replacement):** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\main.ts`

```ts
import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { validateEnv } from './config/env'

const logger = new Logger('Bootstrap')

async function bootstrap(): Promise<void> {
  // Fail fast if env is invalid — app refuses to start
  const env = validateEnv()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  )

  app.setGlobalPrefix('api/v1', { exclude: ['/health'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  app.enableCors({
    origin: env.FRONTEND_URL ?? (env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000'),
    credentials: true,
  })

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DataScriba API')
      .setDescription('Your AI-powered data scribe — REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    logger.log('Swagger UI available at /api/docs')
  }

  await app.listen(env.API_PORT, env.API_HOST)
  logger.log(`DataScriba API running on http://${env.API_HOST}:${env.API_PORT}`)
  logger.log(`Environment: ${env.NODE_ENV}`)
}

void bootstrap()
```

---

### Step 27 — Create unit tests for the DataSource service

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.service.spec.ts`

```ts
import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DataSourceRecord } from '@datascriba/shared-types'

import { DataSourceRepository } from './data-source.repository'
import { DataSourceService } from './data-source.service'
import type { CreateDataSourceDto } from './dto/create-data-source.dto'

// Provide a fixed encryption key in tests
const TEST_KEY = 'a'.repeat(64)

describe('DataSourceService', () => {
  let service: DataSourceService
  let repository: DataSourceRepository

  beforeEach(async () => {
    vi.stubEnv('ENCRYPTION_MASTER_KEY', TEST_KEY)

    const module: TestingModule = await Test.createTestingModule({
      providers: [DataSourceService, DataSourceRepository],
    }).compile()

    service = module.get<DataSourceService>(DataSourceService)
    repository = module.get<DataSourceRepository>(DataSourceRepository)
  })

  describe('create', () => {
    it('stores a record with encrypted connection string', async () => {
      const dto: CreateDataSourceDto = {
        name: 'Test DB',
        type: 'postgresql',
        connectionString: 'postgresql://user:pass@localhost/test',
      }
      const record = await service.create(dto)
      expect(record.name).toBe('Test DB')
      expect(record.encryptedConnectionString).toBe('[REDACTED]')
      expect(record.id).toBeDefined()
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('returns sanitized record', async () => {
      const dto: CreateDataSourceDto = {
        name: 'DB',
        type: 'sqlite',
        connectionString: ':memory:',
      }
      const created = await service.create(dto)
      const found = await service.findOne(created.id)
      expect(found.id).toBe(created.id)
      expect(found.encryptedConnectionString).toBe('[REDACTED]')
    })
  })

  describe('remove', () => {
    it('throws NotFoundException when deleting nonexistent id', async () => {
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException)
    })

    it('removes the record', async () => {
      const dto: CreateDataSourceDto = {
        name: 'Temp',
        type: 'sqlite',
        connectionString: ':memory:',
      }
      const created = await service.create(dto)
      await service.remove(created.id)
      await expect(service.findOne(created.id)).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates name and returns sanitized record', async () => {
      const dto: CreateDataSourceDto = { name: 'Old', type: 'sqlite', connectionString: ':memory:' }
      const created = await service.create(dto)
      const updated = await service.update(created.id, { name: 'New' })
      expect(updated.name).toBe('New')
      expect(updated.encryptedConnectionString).toBe('[REDACTED]')
    })
  })

  describe('findAll', () => {
    it('returns only records for the given workspaceId', async () => {
      await service.create({ name: 'A', type: 'sqlite', connectionString: ':memory:', workspaceId: 'ws-1' })
      await service.create({ name: 'B', type: 'sqlite', connectionString: ':memory:', workspaceId: 'ws-2' })
      const ws1 = await service.findAll('ws-1')
      expect(ws1).toHaveLength(1)
      expect(ws1[0]?.name).toBe('A')
    })
  })
})
```

---

### Step 28 — Update `apps/api/package.json` to add new runtime deps (if not already installed via Step 1)

**File (full replacement):** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\package.json`

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
    "@datascriba/db-drivers": "workspace:*",
    "@datascriba/shared-types": "workspace:*",
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-fastify": "^10.4.15",
    "@nestjs/swagger": "^8.1.0",
    "@prisma/client": "^6.2.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "fastify": "^5.2.1",
    "nestjs-pino": "^4.1.0",
    "pino": "^9.6.0",
    "pino-http": "^10.4.0",
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
    "@types/node": "^22.10.7",
    "@types/supertest": "^6.0.2",
    "@vitest/coverage-v8": "^2.1.9",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "prettier": "^3.3.3",
    "prisma": "^6.2.1",
    "supertest": "^7.0.0",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

---

### Step 29 — Create the Prisma schema with DataSource model (stub — no migration yet)

Create the directory first:

```powershell
New-Item -ItemType Directory -Path "C:\Users\Cub\datascriba\Projects\datascriba\apps\api\prisma" -Force
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\prisma\schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Phase 1 — placeholder for future User/Workspace models

// Phase 2 — DataSource model
// NOTE: No migration is run in Phase 2. DataSourceRepository uses an in-memory Map stub.
// Phase 3 will run `prisma migrate dev` with a real DB.
model DataSource {
  id                        String   @id @default(cuid())
  workspaceId               String
  name                      String   @db.VarChar(100)
  type                      String   // 'postgresql' | 'mysql' | 'mssql' | 'sqlite'
  encryptedConnectionString String   @db.Text
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@index([workspaceId])
  @@map("data_sources")
}
```

---

### Step 30 — Create `docker/docker-compose.yml` with PostgreSQL 16 and Redis 7

Create directory:

```powershell
New-Item -ItemType Directory -Path "C:\Users\Cub\datascriba\Projects\datascriba\docker" -Force
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\docker\docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: datascriba-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: datascriba
      POSTGRES_PASSWORD: datascriba
      POSTGRES_DB: datascriba
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U datascriba -d datascriba']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    container_name: datascriba-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  postgres_data:
  redis_data:
```

---

### Step 31 — Create the PostgreSQL driver integration test

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\drivers\postgresql.driver.spec.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QueryBlockedError } from '../errors'
import { PostgresqlDriver } from './postgresql.driver'

/**
 * Integration test — requires a running PostgreSQL instance.
 * Run: `pnpm docker:up` then `pnpm --filter=@datascriba/db-drivers test`
 * Set TEST_POSTGRES_URL in .env.test or environment before running.
 */
const POSTGRES_URL =
  process.env['TEST_POSTGRES_URL'] ?? 'postgresql://datascriba:datascriba@localhost:5432/datascriba'

describe.skipIf(!process.env['TEST_POSTGRES_URL'] && process.env['CI'] !== 'true')(
  'PostgresqlDriver (integration)',
  () => {
    let driver: PostgresqlDriver

    beforeAll(() => {
      driver = new PostgresqlDriver({ connectionString: POSTGRES_URL, allowMutations: false })
    })

    afterAll(async () => {
      await driver.close()
    })

    it('test() returns true for a valid connection', async () => {
      const result = await driver.test()
      expect(result).toBe(true)
    })

    it('listTables() returns an array', async () => {
      const tables = await driver.listTables()
      expect(Array.isArray(tables)).toBe(true)
    })

    it('execute() runs a parameterized SELECT', async () => {
      const result = await driver.execute('SELECT $1::int AS num', [42])
      expect(result.rows[0]).toMatchObject({ num: 42 })
      expect(result.rowCount).toBe(1)
    })

    it('execute() blocks DROP TABLE when allowMutations=false', async () => {
      await expect(driver.execute('DROP TABLE IF EXISTS nonexistent', [])).rejects.toThrow(
        QueryBlockedError,
      )
    })

    it('streamExecute() yields rows', async () => {
      const rows: unknown[] = []
      for await (const row of driver.streamExecute('SELECT generate_series(1,3) AS n', [])) {
        rows.push(row)
      }
      expect(rows).toHaveLength(3)
    })
  },
)
```

---

### Step 32 — Add `@datascriba/db-drivers` to turbo.json build pipeline

**File (full replacement):** `C:\Users\Cub\datascriba\Projects\datascriba\turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "inputs": ["$TURBO_DEFAULT$"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env.test*"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "cache": false
    },
    "format:check": {
      "inputs": ["$TURBO_DEFAULT$"]
    }
  }
}
```

(No change needed — existing turbo.json already handles `^build` dependency chain correctly. `db-drivers` will be built before `api` automatically.)

---

### Step 33 — Create `.env.test` for integration tests

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\.env.test`

```
NODE_ENV=test
DATABASE_URL=postgresql://datascriba:datascriba@localhost:5432/datascriba
ENCRYPTION_MASTER_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
API_PORT=3002
API_HOST=127.0.0.1
```

**File:** `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\.env.test`

```
TEST_POSTGRES_URL=postgresql://datascriba:datascriba@localhost:5432/datascriba
```

---

### Step 34 — Install all dependencies

From monorepo root:

```powershell
pnpm install
```

Expected: pnpm resolves all workspace packages, including `@datascriba/db-drivers`.

---

### Step 35 — Verify TypeScript compilation

```powershell
pnpm --filter=@datascriba/db-drivers run type-check
pnpm --filter=@datascriba/api run type-check
```

Both must exit 0 with no errors.

---

### Step 36 — Run unit tests

```powershell
pnpm --filter=@datascriba/db-drivers run test
pnpm --filter=@datascriba/api run test
```

Expected:
- `db-drivers`: `crypto.spec.ts` (5 tests) + `query-guard.spec.ts` (7 tests) — all pass
- `api`: `app.controller.spec.ts` (3) + `data-source.service.spec.ts` (6) — all pass

---

### Step 37 — Start docker and run PostgreSQL integration test

```powershell
# Start containers
pnpm docker:up

# Wait ~10s for Postgres to be healthy, then run integration test
$env:TEST_POSTGRES_URL = "postgresql://datascriba:datascriba@localhost:5432/datascriba"
pnpm --filter=@datascriba/db-drivers run test
```

Expected: PostgreSQL integration tests in `postgresql.driver.spec.ts` run and pass.

---

### Step 38 — Type-check the whole monorepo

```powershell
pnpm type-check
```

Expected: exits 0 for all packages.

---

### Step 39 — Smoke-test the API

```powershell
# Terminal 1: set env and start server
$env:ENCRYPTION_MASTER_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
$env:DATABASE_URL = "postgresql://datascriba:datascriba@localhost:5432/datascriba"
pnpm --filter=@datascriba/api run dev

# Terminal 2: create a data source
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/data-sources" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Local SQLite","type":"sqlite","connectionString":":memory:"}'

# Test connection
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/data-sources/{ID_FROM_ABOVE}/test" -Method POST

# Execute a query
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/data-sources/{ID_FROM_ABOVE}/execute" -Method POST `
  -ContentType "application/json" `
  -Body '{"sql":"SELECT 1 AS n","params":[]}'
```

---

### Step 40 — Verify env guard: start without ENCRYPTION_MASTER_KEY

```powershell
# Remove the env var
Remove-Item Env:\ENCRYPTION_MASTER_KEY -ErrorAction SilentlyContinue
$env:DATABASE_URL = "postgresql://datascriba:datascriba@localhost:5432/datascriba"

pnpm --filter=@datascriba/api run dev
```

Expected: app crashes at startup with:

```
Environment validation failed:
  ENCRYPTION_MASTER_KEY: ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)
```

---

## Final Directory Structure

```
C:\Users\Cub\datascriba\Projects\datascriba\
├── apps/
│   └── api/
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── common/
│       │   │   └── filters/
│       │   │       └── app-exception.filter.ts        [NEW]
│       │   ├── config/
│       │   │   └── env.ts                             [NEW]
│       │   ├── modules/
│       │   │   └── data-source/
│       │   │       ├── dto/
│       │   │       │   ├── create-data-source.dto.ts  [NEW]
│       │   │       │   ├── execute-query.dto.ts        [NEW]
│       │   │       │   └── update-data-source.dto.ts  [NEW]
│       │   │       ├── data-source.controller.ts      [NEW]
│       │   │       ├── data-source.module.ts          [NEW]
│       │   │       ├── data-source.repository.ts      [NEW]
│       │   │       ├── data-source.service.ts         [NEW]
│       │   │       └── data-source.service.spec.ts    [NEW]
│       │   ├── app.controller.ts                      [MODIFIED]
│       │   ├── app.controller.spec.ts
│       │   ├── app.module.ts                          [MODIFIED]
│       │   ├── app.service.ts                         [MODIFIED]
│       │   └── main.ts                                [MODIFIED]
│       ├── .env.test                                  [NEW]
│       ├── .eslintrc.js                               [MODIFIED]
│       └── package.json                               [MODIFIED]
├── docker/
│   └── docker-compose.yml                             [NEW]
├── packages/
│   ├── db-drivers/                                    [NEW PACKAGE]
│   │   ├── src/
│   │   │   ├── drivers/
│   │   │   │   ├── mssql.driver.ts
│   │   │   │   ├── mysql.driver.ts
│   │   │   │   ├── postgresql.driver.ts
│   │   │   │   ├── postgresql.driver.spec.ts
│   │   │   │   └── sqlite.driver.ts
│   │   │   ├── crypto.ts
│   │   │   ├── crypto.spec.ts
│   │   │   ├── driver-factory.ts
│   │   │   ├── errors.ts
│   │   │   ├── index.ts
│   │   │   ├── pool-manager.ts
│   │   │   ├── query-guard.ts
│   │   │   ├── query-guard.spec.ts
│   │   │   ├── schema-cache.ts
│   │   │   └── types.ts
│   │   ├── .env.test
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── shared-types/
│   │   └── src/
│   │       ├── common.ts
│   │       ├── data-source.ts                         [NEW]
│   │       └── index.ts                               [MODIFIED]
│   ├── eslint-config/
│   └── tsconfig/
├── .env.example                                       [no change]
├── CLAUDE.md
├── ROADMAP.md
├── TASK_PLAN.md
└── turbo.json                                         [no change needed]
```

---

## Acceptance Criteria

All must pass before builder marks Phase 2 done:

- [ ] **AC-1:** `pnpm --filter=@datascriba/db-drivers run type-check` exits 0
- [ ] **AC-2:** `pnpm --filter=@datascriba/api run type-check` exits 0
- [ ] **AC-3:** `pnpm --filter=@datascriba/db-drivers run test` — all unit tests pass (crypto: 5, query-guard: 7)
- [ ] **AC-4:** `pnpm --filter=@datascriba/api run test` — all unit tests pass (app: 3, data-source.service: 6)
- [ ] **AC-5 (integration):** PostgreSQL integration test in `postgresql.driver.spec.ts` passes against `docker compose up` Postgres 16
- [ ] **AC-6:** AES-256-GCM encrypt/decrypt round-trip verified by `crypto.spec.ts` test
- [ ] **AC-7:** `assertQueryAllowed` blocks `DROP TABLE`, `TRUNCATE`, `DELETE FROM` — verified by `query-guard.spec.ts`
- [ ] **AC-8:** App refuses to start when `ENCRYPTION_MASTER_KEY` is missing — Zod throws at `validateEnv()` before NestJS bootstraps
- [ ] **AC-9:** `POST /api/v1/data-sources` creates a record and returns `encryptedConnectionString: '[REDACTED]'`
- [ ] **AC-10:** `POST /api/v1/data-sources/:id/test` returns `{ ok: true }` for a valid SQLite `:memory:` source
- [ ] **AC-11:** `POST /api/v1/data-sources/:id/execute` with `DROP TABLE` SQL returns HTTP 403 Forbidden
- [ ] **AC-12:** No `any` type in any `.ts` source file (enforced by ESLint `@typescript-eslint/no-explicit-any: error`)
- [ ] **AC-13:** No `console.log` in any source file (enforced by ESLint `no-console: error`)
- [ ] **AC-14:** `docker/docker-compose.yml` contains PostgreSQL 16 and Redis 7 services with healthchecks
- [ ] **AC-15:** `packages/db-drivers` is registered in pnpm workspace and resolves as `@datascriba/db-drivers`
- [ ] **AC-16:** `packages/shared-types/src/data-source.ts` exports `DataSourceType`, `TableMeta`, `ColumnMeta`, `Row`, `QueryResult`, `DataSourceRecord`
- [ ] **AC-17:** `GET /api/v1/data-sources/:id/tables` returns `TableMeta[]` from schema introspection cache on second call (verify by checking no second DB query is issued)
- [ ] **AC-18:** `pnpm type-check` (all packages) exits 0

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Driver package | `packages/db-drivers` separate from `apps/api` | Clean separation; worker app in Phase 6 will also import drivers |
| Crypto helper location | `packages/db-drivers/src/crypto.ts` | Crypto belongs to the driver layer; API calls it via the package export |
| Prisma stub | In-memory `Map` in `DataSourceRepository` | Avoids needing a live DB in Phase 2; Phase 3 replaces with real Prisma |
| DTO validation | `class-validator` decorators for HTTP layer; Zod for env | `class-validator` integrates with `ValidationPipe`; Zod for env per CLAUDE.md |
| Connection string exposure | Always `[REDACTED]` in HTTP responses | Prevents secret leakage via API; internal `getRecord()` decrypts only within service |
| SQL blocking scope | Block `DROP/TRUNCATE/DELETE FROM` when `allowMutations=false` | Allow reporting use case (SELECT/INSERT for audit) while blocking destructive ops |
| Pool manager | Singleton `DriverPoolManager` in service | One pool per DataSource ID; released on delete/update to avoid stale pools |
| Schema cache TTL | 5 minutes in-memory | Acceptable for Phase 2; Redis upgrade in Phase 6 |
| SQLite `streamExecute` | Collects all rows then yields | `better-sqlite3` is synchronous; true streaming not possible without extra libraries |
| MSSQL `@p1/@p2` params | Input names `p1`, `p2`, ... | `mssql` package requires named input params; numbered convention avoids collision |
| Error HTTP mapping | `QueryBlockedError` → 403, `QueryTimeoutError` → 408, `ConnectionError` → 502 | Semantically correct HTTP codes for each domain error type |
| `ENCRYPTION_MASTER_KEY` format | 64-char hex string = 32 bytes | AES-256 requires exactly 32 bytes; hex encoding is portable and verifiable by regex |

---

## Handoff to Builder

```
Ready for: builder agent
File: TASK_PLAN.md (this document)

Execution order:
  1. Apply Phase 1 review fixes (Step 0) — small, non-breaking
  2. Create packages/db-drivers structure (Steps 2-18)
  3. Create shared types additions (Step 5)
  4. Create api config and filter (Steps 19-20)
  5. Create DTOs, repository, service, controller, module (Steps 21-25)
  6. Wire everything into AppModule and update main.ts (Step 26)
  7. Write service unit tests (Step 27)
  8. Update api package.json (Step 28)
  9. Create Prisma schema stub (Step 29)
  10. Create docker-compose (Step 30)
  11. Write PostgreSQL integration test (Step 31)
  12. Install deps and verify (Steps 34-40)

Key risks:
  - Windows path separators: all file content uses forward slashes in TypeScript imports
  - better-sqlite3 native bindings: may need `node-gyp` and Python on Windows — if install
    fails, try `pnpm --filter=@datascriba/db-drivers add better-sqlite3 --build-from-source`
  - mssql v11 requires Node 18+: confirmed compatible with Node 22 LTS
  - SQLite PRAGMA table_info returns named columns: use exact column names from spec above
  - The `crypto.randomUUID()` call in repository requires Node 19+ or `node:crypto` import —
    the existing target is Node 22 LTS so this is fine; no polyfill needed
  - PostgreSQL integration test is skipped when TEST_POSTGRES_URL env var is absent and CI
    is not 'true' — developer must run `pnpm docker:up` and set the env var manually

Next command after implementation:
  "Use the reviewer agent to review the Phase 2 implementation against CLAUDE.md"
```

---

### Critical Files for Implementation

- `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\index.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\packages\db-drivers\src\crypto.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\modules\data-source\data-source.service.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\config\env.ts`
- `C:\Users\Cub\datascriba\Projects\datascriba\apps\api\src\common\filters\app-exception.filter.ts`