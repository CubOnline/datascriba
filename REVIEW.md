# REVIEW.md — Phase 2: Veri Kaynağı Yönetimi (MSSQL)

**Reviewer:** reviewer agent
**Date:** 2026-05-13
**Verdict:** APPROVED_WITH_CHANGES

---

## Executive Summary

Phase 2 delivers a solid, well-structured MSSQL data source management implementation. The crypto layer (AES-256-GCM), query guard, NestJS module wiring, and overall TypeScript hygiene are all high quality. No `any`, no `console.log`, no `var`, no `==` — CLAUDE.md basics are clean throughout all reviewed files.

Three issues require fixing before commit: (1) query timeout is checked *after* the query completes rather than enforced as a hard deadline, (2) the `executeQuery` endpoint accepts a raw inline `{ sql, params }` body with no typed DTO or class-validator decorators — `ValidationPipe` does not validate inline types, (3) `DataSourceService.getDriver` is missing its explicit return type annotation. Five warnings should be addressed soon, including `vi.stubEnv` leaking between test files, SQL being logged verbatim on execute errors, and the service reading `process.env` directly instead of the validated `env` module.

---

## Dimension Scores

| Dimension | Status | Notes |
|-----------|--------|-------|
| TypeScript strictness | ⚠️ WARNING | One missing explicit return type on `getDriver`; `unknown[]` params typing is intentionally loose but acceptable |
| Security | ⚠️ WARNING | Timeout is post-hoc only; SQL logged verbatim on execute error; `executeQuery` body is untyped; EXEC/xp_ not blocked |
| NestJS patterns | ✅ PASS | Module wiring correct, APP_FILTER global via token, ValidationPipe strict, Swagger disabled in production |
| Error handling | ✅ PASS | All paths caught and mapped, no swallowed errors, stack traces not exposed in HTTP responses |
| Test quality | ⚠️ WARNING | `vi.stubEnv` not restored; no test for `update` re-encryption; query-guard has no test verifying INSERT/UPDATE are allowed |
| Crypto implementation | ✅ PASS | IV fresh per call, authTag verified, key length validated (32 bytes), hex encoding correct |
| CLAUDE.md compliance | ✅ PASS | No `any`, no `console.log`, no `var`, no `==`, named exports used, process.stdout/stderr in logger (not console) |
| Builder deviations | ✅ PASS | All 5 deviations are justified (see section below) |

---

## Issues Found

### Critical (must fix before commit)

**C-1 — Query timeout is post-hoc only — does not actually limit execution time**
File: `packages/db-drivers/src/drivers/mssql.driver.ts`, lines 115–119

```ts
const start = Date.now()
const result = await request.query(sql)   // ← runs to full completion regardless
const durationMs = Date.now() - start
if (durationMs > this.queryTimeoutMs) throw new QueryTimeoutError(sql, this.queryTimeoutMs)
```

The query runs to completion before the timeout is evaluated. A 60-second query against a `queryTimeoutMs: 5000` driver will block for the full 60 seconds. The mssql `Request` object exposes a `timeout` property that sets the SQL Server request timeout at the TDS protocol level. Fix:

```ts
const request = pool.request()
request.timeout = this.queryTimeoutMs   // enforce at protocol level
params.forEach((p, i) => { request.input(`p${i + 1}`, p) })
const start = Date.now()
const result = await request.query(sql)
const durationMs = Date.now() - start
```

The post-hoc `durationMs` check can remain for metrics, but the hard limit must be enforced before the query is sent.

---

**C-2 — `executeQuery` endpoint has no typed DTO — `ValidationPipe` silently passes invalid input**
File: `apps/api/src/modules/data-source/data-source.controller.ts`, lines 103–106

```ts
@Post(':id/execute')
async executeQuery(
  @Param('id') id: string,
  @Body() body: { sql: string; params?: unknown[] },
): Promise<QueryResult> {
```

The body is an inline TypeScript type literal. NestJS `ValidationPipe` (with `whitelist: true` and `forbidNonWhitelisted: true`) operates on class instances and their decorator metadata — it does not validate plain interface/object types. A request body of `{}` (missing `sql`) reaches `DataSourceService.executeQuery(id, undefined, [])` and causes a runtime crash rather than a clean `400 Bad Request`.

Fix: create `apps/api/src/modules/data-source/dto/execute-query.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator'

export class ExecuteQueryDto {
  @ApiProperty({ description: 'SQL query to execute', example: 'SELECT TOP 10 * FROM dbo.Orders' })
  @IsString()
  @MinLength(1)
  sql!: string

  @ApiPropertyOptional({ description: 'Query parameters', type: [Object] })
  @IsOptional()
  @IsArray()
  params?: unknown[]
}
```

Then use `@Body() dto: ExecuteQueryDto` in the controller.

---

**C-3 — `DataSourceService.getDriver` missing explicit return type (CLAUDE.md violation)**
File: `apps/api/src/modules/data-source/data-source.service.ts`, line 119

```ts
private getDriver(record: DataSourceRecord) {
```

CLAUDE.md mandates explicit return types on exported functions. By convention the same applies to private methods on injectable services since they participate in the public interface indirectly. Add the return type:

```ts
private getDriver(record: DataSourceRecord): DataSourceDriver {
```

---

### Warnings (should fix soon)

**W-1 — SQL string logged verbatim on execute errors — potential data exposure**
File: `packages/db-drivers/src/drivers/mssql.driver.ts`, line 140

```ts
logger.error({ err, sql }, 'MSSQL execute failed')
```

User-supplied SQL appears in structured logs at the `err` level. Even though parameterized queries prevent injection, the SQL text itself may contain schema names, column names, or business logic that should not appear in log aggregation systems shipped to third-party observability services. Consider logging only the first 200 characters (`sql.slice(0, 200)`) or a hash of the SQL, and relying on the `QueryError` object's `.sql` field for internal debugging only.

---

**W-2 — `vi.stubEnv` is not restored between test files**
File: `apps/api/src/modules/data-source/data-source.service.spec.ts`, line 19

```ts
vi.stubEnv('ENCRYPTION_MASTER_KEY', TEST_KEY)
```

Without a corresponding `afterEach(() => vi.unstubAllEnvs())`, the environment stub persists across test modules when Vitest runs with `--pool=threads` (the default). This causes non-deterministic test failures in other spec files that depend on `process.env`. Add:

```ts
afterEach(() => {
  vi.unstubAllEnvs()
})
```

---

**W-3 — No test for `update` with a new connection string (re-encryption path)**
File: `apps/api/src/modules/data-source/data-source.service.spec.ts`

The `update` describe block (lines 96–112) only tests name changes. There is no test verifying that passing a new `connectionString` to `update` results in re-encryption in the repository. This is the same encrypt/decrypt lifecycle pattern covered by the `create` test (line 42) and should be mirrored:

```ts
it('re-encrypts the connection string on update', async () => {
  const created = await service.create({ name: 'DB', type: 'mssql', connectionString: 'Server=old;' })
  await service.update(created.id, { connectionString: 'Server=new;' })
  const stored = (await repository.findAll('default'))[0]
  expect(stored?.encryptedConnectionString).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
  expect(stored?.encryptedConnectionString).not.toContain('Server=new')
})
```

---

**W-4 — MSSQL-specific dangerous constructs not blocked by query guard**
File: `packages/db-drivers/src/query-guard.ts`

`BLOCKED_PATTERNS` covers `DROP`, `TRUNCATE`, and `DELETE FROM`. MSSQL-specific attack vectors are absent:
- `EXEC xp_cmdshell(...)` — executes OS commands
- `EXEC sp_configure` — alters server settings
- `OPENROWSET` / `OPENQUERY` — lateral movement to remote servers

At minimum add:

```ts
/\bEXEC\s+xp_/i,
/\bEXEC\s+sp_configure\b/i,
/\bOPENROWSET\b/i,
/\bOPENQUERY\b/i,
```

This is a defense-in-depth concern — parameterized queries already prevent injection — but the guard's purpose is to provide an additional safety layer for the reporting context.

---

**W-5 — `DataSourceService.getMasterKey` reads `process.env` directly, bypassing the validated `env` module**
File: `apps/api/src/modules/data-source/data-source.service.ts`, lines 26–29

```ts
private getMasterKey(): string {
  const key = process.env['ENCRYPTION_MASTER_KEY']
  if (!key) throw new Error('ENCRYPTION_MASTER_KEY is not set')
  return key
}
```

`apps/api/src/config/env.ts` exports a Zod-validated `env` object that guarantees `ENCRYPTION_MASTER_KEY` is a valid 64-character hex string before the app starts. The service re-implements the "is it set?" guard and misses the hex-format validation. The correct pattern:

```ts
import { env } from '../../config/env'
// ...
private getMasterKey(): string {
  return env.ENCRYPTION_MASTER_KEY
}
```

This eliminates duplicated validation logic and ensures `getMasterKey()` can never return an invalid key that passes the empty-string check but fails the `Buffer.from(key, 'hex').length !== 32` check inside `crypto.ts`.

---

### Suggestions (optional)

**S-1 — `SchemaCache` is untyped — forces callers to cast**
File: `packages/db-drivers/src/schema-cache.ts`, line 20 / `apps/api/src/modules/data-source/data-source.service.ts`, line 92

`get(key: string): unknown | null` forces the caller to write `cached as TableMeta[]`. Consider making `SchemaCache` generic:

```ts
export class SchemaCache<T> {
  get(key: string): T | null { ... }
  set(key: string, value: T, ttlMs?: number): void { ... }
}
```

Usage: `private readonly schemaCache = new SchemaCache<TableMeta[]>()`. Eliminates unsafe casts.

---

**S-2 — `POST /data-sources` returns `200 OK` instead of `201 Created`**
File: `apps/api/src/modules/data-source/data-source.controller.ts`, lines 32–36

REST convention for resource creation is `201 Created`. Add `@HttpCode(HttpStatus.CREATED)` to the `create` handler and add an `@ApiCreatedResponse` decorator to make Swagger accurate.

---

**S-3 — `createLogger` uses `process.stdout.write` — should be replaced with injected Pino in Phase 3**
File: `packages/db-drivers/src/logger.ts`, lines 17–24

Not a CLAUDE.md violation (no `console.log`), and keeping `db-drivers` dependency-free is a reasonable design choice. However, the custom logger does not support log level filtering, sampling, or redaction. In Phase 3 when `nestjs-pino` is integrated at the API layer, `MssqlDriver` should accept an optional `Logger` via its constructor so the NestJS Pino instance is propagated down. Track as a Phase 3 TODO.

---

**S-4 — `require('mssql')` workaround lacks an ADR**
File: `packages/db-drivers/src/drivers/mssql.driver.ts`, lines 9–10

```ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mssql = require('mssql') as typeof import('mssql')
```

The comment explains the CJS/ESM issue. This decision should be recorded in `docs/adr/` so future contributors do not attempt to convert this to an `import` statement (which breaks at runtime).

---

**S-5 — Docker Compose has no MSSQL service for local development**
File: `docker/docker-compose.yml`

Phase 2 adds MSSQL driver support, but the compose file includes only PostgreSQL and Redis. Integration testing against a live MSSQL instance requires a separate setup. Consider adding an `mssql` service (`mcr.microsoft.com/mssql/server:2022-latest`) behind a Docker Compose profile so it is opt-in:

```yaml
mssql:
  image: mcr.microsoft.com/mssql/server:2022-latest
  profiles: [mssql]
  environment:
    SA_PASSWORD: "YourStrong!Passw0rd"
    ACCEPT_EULA: "Y"
  ports:
    - '1433:1433'
```

---

## Builder Deviations — Justified?

| # | Deviation | Verdict | Reasoning |
|---|-----------|---------|-----------|
| 1 | Only MSSQL implemented; other driver types throw `UnsupportedDriverError` | **Justified** | The exhaustive `never` check in `driver-factory.ts` line 19 provides compile-time safety when new types are added to `DataSourceType`. Correct Phase 2 scope; no dead code. |
| 2 | Package renamed `PoolManager` (was `ConnectionPoolManager` in plan) | **Justified** | Shorter name, identical semantics, no public API contract yet. Zero impact. |
| 3 | No Prisma — in-memory `DataSourceRepository` stub | **Justified** | Prisma schema is not yet migrated. The stub faithfully mirrors Prisma semantics (`null` on not found, typed return values). Phase 3 replaces it. The abstraction layer (repository pattern) makes this a clean swap. |
| 4 | MSSQL connection string string overload passed to `mssql.connect` | **Justified with caveat** | `mssql.connect(connectionString)` is a documented overload. The string originates from AES-256-GCM decryption, never from raw user input, and is never logged (confirmed by search). **Caveat:** documentation and examples in the repo should note that production connection strings must include `Encrypt=true;TrustServerCertificate=false` to prevent MITM. |
| 5 | No `nestjs-pino` — NestJS built-in `Logger` in API layer, custom `createLogger` in `db-drivers` | **Acceptable for Phase 2** | CLAUDE.md specifies Pino but `nestjs-pino` integration is a cross-cutting infrastructure decision. The custom logger produces structured JSON to stdout/stderr which Pino-compatible collectors can ingest. Must be upgraded to `nestjs-pino` in Phase 3 when HTTP request logging and correlation IDs are needed. |

---

## Verdict Details

**APPROVED_WITH_CHANGES.** The implementation is architecturally correct and the security-critical paths (encryption, query guard, error masking) are sound. All three critical issues are contained to the `execute` query path (C-1, C-2) and a style violation (C-3); none require architectural redesign.

**Required before commit:**

1. **C-1** — Set `request.timeout = this.queryTimeoutMs` in `mssql.driver.ts` before calling `request.query(sql)` to enforce the timeout at the TDS protocol level.
2. **C-2** — Create `ExecuteQueryDto` class with `@IsString() @MinLength(1) sql` and `@IsOptional() @IsArray() params`, and use it in the `executeQuery` controller action.
3. **C-3** — Add `: DataSourceDriver` explicit return type to `DataSourceService.getDriver`.

Warnings W-1 through W-5 should be tracked as follow-up tickets but do not block commit given the Phase 2 scope.

---

## Handoff Note

**Needs fixes first (C-1, C-2, C-3).** Builder should address the three critical items. Once resolved, hand off to the tester agent with the following targets:

- Verify `request.timeout` is enforced: mock a slow query and assert `QueryTimeoutError` is thrown within the configured window (not after).
- Add tests for `ExecuteQueryDto`: missing `sql` field yields `400`, non-string `sql` yields `400`.
- Add a test for `update` with a new `connectionString` verifying re-encryption in the repository (mirrors the existing `create` encryption test).
- Add `afterEach(() => vi.unstubAllEnvs())` to `data-source.service.spec.ts`.
- Verify `query-guard.spec.ts` covers `INSERT` and `UPDATE` as explicitly allowed operations.
