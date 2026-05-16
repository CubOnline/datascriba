# TASK_PLAN.md — Faz 8: Test, Doküman & Deploy

**Üreten:** planner agent  
**Tarih:** 2026-05-16  
**Faz:** 8 — Test, Doküman & Deploy  
**Okuyacak:** builder, reviewer, tester  

---

## Genel Kurallar

- KOD YAZARKEN hiç karar alma — bu plan yeterince detaylıdır.
- Adımları sırayla uygula. Her STEP bağımsız commit olabilir.
- Mevcut test dosyaları (`parameters.spec.ts`, `csv.renderer.spec.ts`, `excel.renderer.spec.ts`, `crypto.spec.ts`, `query-guard.spec.ts`) ZATEN VAR — üzerine yazma, bırak oldukları gibi.
- E2E testler gerçek DB/Redis bağlantısı gerektirmez: repository'leri ve driver'ları `vi.fn()` ile mock'la.
- `console.log` yasak — testlerde de.
- Coverage hedefi: `packages/` ve `apps/api/` için %80+.
- Tüm yeni dosyalar `kebab-case` isimlendirilmeli.

---

## STEP 1 — Backend Integration Tests: DataSource E2E

**Dosya:** `apps/api/src/modules/data-source/data-source.e2e-spec.ts`

**Strateji:**
- NestJS `Test.createTestingModule` ile modülü boot et.
- `DataSourceRepository`'yi mock'la (in-memory store pattern).
- `DataSourceService.testConnection` içindeki `PoolManager` + `createDriver` çağrısını mock'la.
- `ENCRYPTION_MASTER_KEY` env'ini test başında set et (`process.env['ENCRYPTION_MASTER_KEY'] = 'a'.repeat(64)`).
- Supertest ile HTTP isteklerini test et.

**İçerik:**

```typescript
// apps/api/src/modules/data-source/data-source.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataSourceModule } from './data-source.module'
import { DataSourceRepository } from './data-source.repository'

// Encryption key: 64 hex chars = 32 bytes
const TEST_KEY = 'a'.repeat(64)

function makeRepoMock() {
  const store = new Map<string, Record<string, unknown>>()
  let seq = 0

  return {
    create: vi.fn(async (data: Record<string, unknown>) => {
      const id = `ds-${++seq}`
      const record = { ...data, id, workspaceId: 'default', createdAt: new Date(), updatedAt: new Date() }
      store.set(id, record)
      return record
    }),
    findAll: vi.fn(async () => [...store.values()]),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const existing = store.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch, updatedAt: new Date() }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn(async (id: string) => {
      const existed = store.has(id)
      store.delete(id)
      return existed
    }),
    _store: store,
    _reset: () => { store.clear(); seq = 0 },
  }
}

describe('DataSource E2E', () => {
  let app: INestApplication
  let repoMock: ReturnType<typeof makeRepoMock>

  beforeAll(async () => {
    process.env['ENCRYPTION_MASTER_KEY'] = TEST_KEY

    repoMock = makeRepoMock()

    const module = await Test.createTestingModule({
      imports: [DataSourceModule],
    })
      .overrideProvider(DataSourceRepository)
      .useValue(repoMock)
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(() => {
    repoMock._reset()
    vi.clearAllMocks()
  })

  const validPayload = {
    name: 'Test MSSQL',
    type: 'mssql',
    host: 'localhost',
    port: 1433,
    database: 'testdb',
    username: 'sa',
    password: 'P@ssw0rd',
  }

  describe('POST /data-sources', () => {
    it('creates a data source and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)
        .expect(201)

      expect(res.body).toMatchObject({ name: 'Test MSSQL', type: 'mssql' })
      expect(res.body.id).toBeDefined()
      expect(res.body.encryptedConnectionString).toBe('[REDACTED]')
    })

    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/data-sources')
        .send({ name: 'incomplete' })
        .expect(400)
    })
  })

  describe('GET /data-sources', () => {
    it('returns empty array when no data sources exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/data-sources')
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(0)
    })

    it('returns created data sources', async () => {
      await request(app.getHttpServer()).post('/data-sources').send(validPayload)

      const res = await request(app.getHttpServer())
        .get('/data-sources')
        .expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0].name).toBe('Test MSSQL')
    })
  })

  describe('GET /data-sources/:id', () => {
    it('returns 200 for existing data source', async () => {
      const created = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)

      const id = created.body.id as string

      const res = await request(app.getHttpServer())
        .get(`/data-sources/${id}`)
        .expect(200)

      expect(res.body.id).toBe(id)
    })

    it('returns 404 for non-existent id', async () => {
      await request(app.getHttpServer())
        .get('/data-sources/nonexistent-id')
        .expect(404)
    })
  })

  describe('PATCH /data-sources/:id', () => {
    it('updates name and returns updated record', async () => {
      const created = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)

      const id = created.body.id as string

      const res = await request(app.getHttpServer())
        .patch(`/data-sources/${id}`)
        .send({ name: 'Updated Name' })
        .expect(200)

      expect(res.body.name).toBe('Updated Name')
    })

    it('returns 404 when updating non-existent data source', async () => {
      await request(app.getHttpServer())
        .patch('/data-sources/ghost')
        .send({ name: 'X' })
        .expect(404)
    })
  })

  describe('DELETE /data-sources/:id', () => {
    it('deletes existing data source and returns 204', async () => {
      const created = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)

      const id = created.body.id as string

      await request(app.getHttpServer())
        .delete(`/data-sources/${id}`)
        .expect(204)

      await request(app.getHttpServer())
        .get(`/data-sources/${id}`)
        .expect(404)
    })

    it('returns 404 when deleting non-existent data source', async () => {
      await request(app.getHttpServer())
        .delete('/data-sources/ghost')
        .expect(404)
    })
  })

  describe('POST /data-sources/:id/test', () => {
    it('endpoint is reachable (returns 200, 500, or 503 — not 404/405)', async () => {
      const created = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)

      const id = created.body.id as string

      const res = await request(app.getHttpServer())
        .post(`/data-sources/${id}/test`)

      expect([200, 500, 503]).toContain(res.status)
    })
  })
})
```

**Notlar:**
- `supertest` package yoksa: `pnpm add -D supertest @types/supertest --filter=api`
- `DataSourceModule`'un `ConfigModule` bağımlılığı varsa mock'la: `.overrideProvider(ConfigService).useValue({ get: vi.fn() })`

---

## STEP 2 — Backend Integration Tests: Report E2E

**Dosya:** `apps/api/src/modules/report/report.e2e-spec.ts`

**Strateji:**
- `ReportRepository` ve `DataSourceService` mock'la.
- `DataSourceService.executeQuery` → sabit `QueryResult` döndür.
- `renderReport` fonksiyonunu `vi.mock('@datascriba/report-engine', ...)` ile mock'la.
- File system (`fs.writeFileSync`) mock'la: `vi.mock('node:fs', ...)`.

**İçerik:**

```typescript
// apps/api/src/modules/report/report.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock report-engine before importing the module
vi.mock('@datascriba/report-engine', () => ({
  renderReport: vi.fn(async () => Buffer.from('fake-output')),
  renderTemplate: vi.fn((sql: string) => sql),
  validateParameters: vi.fn((_params: unknown, values: Record<string, unknown>) => values),
}))

// Mock node:fs to avoid actual file writes
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import { DataSourceService } from '../data-source/data-source.service'
import { ReportModule } from './report.module'
import { ReportRepository } from './report.repository'

const TEST_KEY = 'a'.repeat(64)

function makeReportRepoMock() {
  const reportStore = new Map<string, Record<string, unknown>>()
  const runStore = new Map<string, Record<string, unknown>>()
  let seq = 0

  return {
    create: vi.fn(async (data: Record<string, unknown>) => {
      const id = `rpt-${++seq}`
      const record = {
        ...data,
        id,
        version: 1,
        createdBy: 'system',
        workspaceId: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      reportStore.set(id, record)
      return record
    }),
    findAll: vi.fn(async () => [...reportStore.values()]),
    findById: vi.fn(async (id: string) => reportStore.get(id) ?? null),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const existing = reportStore.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch, updatedAt: new Date() }
      reportStore.set(id, updated)
      return updated
    }),
    delete: vi.fn(async (id: string) => {
      const existed = reportStore.has(id)
      reportStore.delete(id)
      return existed
    }),
    createRun: vi.fn(async (run: Record<string, unknown>) => {
      runStore.set(run['id'] as string, run)
      return run
    }),
    updateRun: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const existing = runStore.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch }
      runStore.set(id, updated)
      return updated
    }),
    findRunsByReportId: vi.fn(async (reportId: string) =>
      [...runStore.values()].filter((r) => r['reportId'] === reportId),
    ),
    findRunById: vi.fn(async (id: string) => runStore.get(id) ?? null),
    _reportStore: reportStore,
    _runStore: runStore,
    _reset: () => { reportStore.clear(); runStore.clear(); seq = 0 },
  }
}

function makeDataSourceServiceMock() {
  return {
    executeQuery: vi.fn(async () => ({
      columns: [
        { name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
        { name: 'name', dataType: 'varchar', nullable: true, isPrimaryKey: false, defaultValue: null },
      ],
      rows: [{ id: 1, name: 'Alice' }],
      rowCount: 1,
    })),
    findOne: vi.fn(async (id: string) => ({ id, name: 'Mock DS', type: 'mssql' })),
    listTables: vi.fn(async () => []),
    describeTable: vi.fn(async () => []),
  }
}

describe('Report E2E', () => {
  let app: INestApplication
  let repoMock: ReturnType<typeof makeReportRepoMock>
  let dsMock: ReturnType<typeof makeDataSourceServiceMock>

  const validReportPayload = {
    name: 'Monthly Sales',
    dataSourceId: 'ds-1',
    query: 'SELECT id, name FROM sales',
    exportFormats: ['csv'],
    parameters: [],
  }

  beforeAll(async () => {
    process.env['ENCRYPTION_MASTER_KEY'] = TEST_KEY

    repoMock = makeReportRepoMock()
    dsMock = makeDataSourceServiceMock()

    const module = await Test.createTestingModule({
      imports: [ReportModule],
    })
      .overrideProvider(ReportRepository)
      .useValue(repoMock)
      .overrideProvider(DataSourceService)
      .useValue(dsMock)
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(() => {
    repoMock._reset()
    vi.clearAllMocks()
  })

  describe('POST /reports', () => {
    it('creates a report and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)
        .expect(201)

      expect(res.body.name).toBe('Monthly Sales')
      expect(res.body.id).toBeDefined()
    })

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/reports')
        .send({ dataSourceId: 'ds-1', query: 'SELECT 1', exportFormats: ['csv'] })
        .expect(400)
    })
  })

  describe('GET /reports', () => {
    it('returns empty array initially', async () => {
      const res = await request(app.getHttpServer()).get('/reports').expect(200)
      expect(res.body).toHaveLength(0)
    })

    it('returns list after creation', async () => {
      await request(app.getHttpServer()).post('/reports').send(validReportPayload)
      const res = await request(app.getHttpServer()).get('/reports').expect(200)
      expect(res.body).toHaveLength(1)
    })
  })

  describe('GET /reports/:id', () => {
    it('returns 404 for unknown id', async () => {
      await request(app.getHttpServer()).get('/reports/nonexistent').expect(404)
    })

    it('returns report for valid id', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      await request(app.getHttpServer())
        .get(`/reports/${created.body.id}`)
        .expect(200)
    })
  })

  describe('PATCH /reports/:id', () => {
    it('updates report name', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      const res = await request(app.getHttpServer())
        .patch(`/reports/${created.body.id}`)
        .send({ name: 'Updated Report' })
        .expect(200)

      expect(res.body.name).toBe('Updated Report')
    })
  })

  describe('DELETE /reports/:id', () => {
    it('deletes a report and returns 204', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      await request(app.getHttpServer())
        .delete(`/reports/${created.body.id}`)
        .expect(204)
    })
  })

  describe('POST /reports/:id/run', () => {
    it('runs a report and returns file buffer with correct content-type', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      const id = created.body.id as string

      const res = await request(app.getHttpServer())
        .post(`/reports/${id}/run`)
        .send({ format: 'csv', parameters: {} })
        .expect(200)

      expect(res.headers['content-type']).toMatch(/text\/csv/)
    })

    it('returns 404 when report does not exist', async () => {
      await request(app.getHttpServer())
        .post('/reports/ghost/run')
        .send({ format: 'csv' })
        .expect(404)
    })

    it('returns 400 for invalid format', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      await request(app.getHttpServer())
        .post(`/reports/${created.body.id}/run`)
        .send({ format: 'pdf' })
        .expect(400)
    })
  })

  describe('GET /reports/:id/runs', () => {
    it('returns run history after a run', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      const id = created.body.id as string

      await request(app.getHttpServer())
        .post(`/reports/${id}/run`)
        .send({ format: 'csv' })

      const res = await request(app.getHttpServer())
        .get(`/reports/${id}/runs`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(1)
    })
  })
})
```

---

## STEP 3 — Backend Integration Tests: Schedule E2E

**Dosya:** `apps/api/src/modules/schedule/schedule.e2e-spec.ts`

**Strateji:**
- `ScheduleRepository` mock'la.
- BullMQ `Queue` (inject token `QUEUE_NAME`) mock'la — `add` metodu `{ id: 'job-1' }` döndürsün.
- `getQueueToken(QUEUE_NAME)` ile inject token'ı override et.

**İçerik:**

```typescript
// apps/api/src/modules/schedule/schedule.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUE_NAME } from '@datascriba/queue-config'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduleModule } from './schedule.module'
import { ScheduleRepository } from './schedule.repository'

function makeScheduleRepoMock() {
  const store = new Map<string, Record<string, unknown>>()
  let seq = 0

  return {
    create: vi.fn(async (data: Record<string, unknown>) => {
      const id = `sch-${++seq}`
      const record = { ...data, id, createdAt: new Date(), updatedAt: new Date() }
      store.set(id, record)
      return record
    }),
    findAll: vi.fn(async () => [...store.values()]),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findEnabled: vi.fn(async () => [...store.values()].filter((s) => s['enabled'] === true)),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const existing = store.get(id)
      if (!existing) return null
      const updated = { ...existing, ...patch, updatedAt: new Date() }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn(async (id: string) => {
      const existed = store.has(id)
      store.delete(id)
      return existed
    }),
    _store: store,
    _reset: () => { store.clear(); seq = 0 },
  }
}

describe('Schedule E2E', () => {
  let app: INestApplication
  let repoMock: ReturnType<typeof makeScheduleRepoMock>
  const queueMock = { add: vi.fn(async () => ({ id: 'job-1' })) }

  const validPayload = {
    reportId: 'rpt-1',
    cronExpression: '0 9 * * 1',
    format: 'csv',
    enabled: true,
  }

  beforeAll(async () => {
    repoMock = makeScheduleRepoMock()

    const module = await Test.createTestingModule({
      imports: [ScheduleModule],
    })
      .overrideProvider(ScheduleRepository)
      .useValue(repoMock)
      .overrideProvider(getQueueToken(QUEUE_NAME))
      .useValue(queueMock)
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  beforeEach(() => {
    repoMock._reset()
    vi.clearAllMocks()
    queueMock.add.mockResolvedValue({ id: 'job-1' })
  })

  describe('POST /schedules', () => {
    it('creates schedule and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)
        .expect(201)

      expect(res.body.cronExpression).toBe('0 9 * * 1')
      expect(res.body.id).toBeDefined()
    })

    it('returns 400 for invalid cron expression', async () => {
      await request(app.getHttpServer())
        .post('/schedules')
        .send({ ...validPayload, cronExpression: 'not-a-cron' })
        .expect(400)
    })

    it('returns 400 when reportId is missing', async () => {
      await request(app.getHttpServer())
        .post('/schedules')
        .send({ cronExpression: '0 9 * * 1', format: 'csv' })
        .expect(400)
    })
  })

  describe('GET /schedules', () => {
    it('returns empty array initially', async () => {
      const res = await request(app.getHttpServer()).get('/schedules').expect(200)
      expect(res.body).toHaveLength(0)
    })

    it('returns created schedules', async () => {
      await request(app.getHttpServer()).post('/schedules').send(validPayload)
      const res = await request(app.getHttpServer()).get('/schedules').expect(200)
      expect(res.body).toHaveLength(1)
    })
  })

  describe('GET /schedules/:id', () => {
    it('returns 404 for unknown id', async () => {
      await request(app.getHttpServer()).get('/schedules/ghost').expect(404)
    })
  })

  describe('PATCH /schedules/:id', () => {
    it('updates enabled flag', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      const res = await request(app.getHttpServer())
        .patch(`/schedules/${created.body.id}`)
        .send({ enabled: false })
        .expect(200)

      expect(res.body.enabled).toBe(false)
    })

    it('returns 400 for invalid cron on update', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      await request(app.getHttpServer())
        .patch(`/schedules/${created.body.id}`)
        .send({ cronExpression: 'bad-cron' })
        .expect(400)
    })
  })

  describe('DELETE /schedules/:id', () => {
    it('deletes schedule and returns 204', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      await request(app.getHttpServer())
        .delete(`/schedules/${created.body.id}`)
        .expect(204)
    })
  })

  describe('POST /schedules/:id/trigger', () => {
    it('triggers schedule and returns jobId', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      const res = await request(app.getHttpServer())
        .post(`/schedules/${created.body.id}/trigger`)
        .expect(200)

      expect(res.body.jobId).toBe('job-1')
      expect(queueMock.add).toHaveBeenCalledOnce()
    })

    it('returns 404 when triggering non-existent schedule', async () => {
      await request(app.getHttpServer())
        .post('/schedules/ghost/trigger')
        .expect(404)
    })
  })
})
```

---

## STEP 4 — Backend Integration Tests: AI E2E

**Dosya:** `apps/api/src/modules/ai/ai.e2e-spec.ts`

**Strateji:**
- `AiService` methodlarını doğrudan mock'la (gerçek Anthropic çağrısı yok).
- SSE endpoint'leri için `request(app.getHttpServer()).post(...).buffer(true)` kullan.
- `ThrottlerGuard`'ı devre dışı bırak: `overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })`.

**İçerik:**

```typescript
// apps/api/src/modules/ai/ai.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard } from '@nestjs/throttler'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { AiModule } from './ai.module'
import { AiService } from './ai.service'

async function* fakeStream(text: string): AsyncIterable<{
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}> {
  yield { type: 'delta', text }
  yield { type: 'done' }
}

function makeAiServiceMock() {
  return {
    onModuleInit: vi.fn(),
    suggestQuery: vi.fn(() => fakeStream('SELECT 1')),
    explainQuery: vi.fn(async () => ({
      turkish: 'Turkce aciklama.',
      english: 'English explanation.',
      model: 'claude-sonnet-4-6',
    })),
    fixQuery: vi.fn(() => fakeStream('SELECT * FROM fixed')),
  }
}

describe('AI E2E', () => {
  let app: INestApplication
  let aiServiceMock: ReturnType<typeof makeAiServiceMock>

  beforeAll(async () => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key'
    process.env['AI_MODEL'] = 'claude-sonnet-4-6'
    process.env['ENCRYPTION_MASTER_KEY'] = 'a'.repeat(64)

    aiServiceMock = makeAiServiceMock()

    const module = await Test.createTestingModule({
      imports: [AiModule],
    })
      .overrideProvider(AiService)
      .useValue(aiServiceMock)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  describe('POST /ai/suggest-query (SSE)', () => {
    it('returns 200 with text/event-stream content-type', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/suggest-query')
        .send({ prompt: 'Show all users', dataSourceId: 'ds-1' })
        .buffer(true)
        .parse((res, callback) => {
          let data = ''
          res.on('data', (chunk: Buffer) => { data += chunk.toString() })
          res.on('end', () => callback(null, data))
        })

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/text\/event-stream/)
      expect(res.body as string).toContain('SELECT 1')
    })

    it('returns 400 when prompt is missing', async () => {
      await request(app.getHttpServer())
        .post('/ai/suggest-query')
        .send({ dataSourceId: 'ds-1' })
        .expect(400)
    })
  })

  describe('POST /ai/explain-query', () => {
    it('returns explanation in turkish and english', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/explain-query')
        .send({ sql: 'SELECT * FROM users' })
        .expect(200)

      expect(res.body.turkish).toBe('Turkce aciklama.')
      expect(res.body.english).toBe('English explanation.')
      expect(res.body.model).toBe('claude-sonnet-4-6')
    })

    it('returns 400 when sql is missing', async () => {
      await request(app.getHttpServer())
        .post('/ai/explain-query')
        .send({})
        .expect(400)
    })
  })

  describe('POST /ai/fix-query (SSE)', () => {
    it('returns 200 with streaming response containing fixed SQL', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/fix-query')
        .send({ sql: 'SELEC * FROM users', errorMessage: 'syntax error' })
        .buffer(true)
        .parse((res, callback) => {
          let data = ''
          res.on('data', (chunk: Buffer) => { data += chunk.toString() })
          res.on('end', () => callback(null, data))
        })

      expect(res.status).toBe(200)
      expect(res.body as string).toContain('fixed')
    })
  })
})
```

---

## STEP 5 — Frontend: use-ai.test.ts

**Dosya:** `apps/web/src/hooks/use-ai.test.ts`

**Strateji:**
- `vitest` + `@testing-library/react` ile hook'ları test et.
- `global.fetch` mock'la: `vi.stubGlobal('fetch', vi.fn())`.
- SSE stream simüle etmek için `ReadableStream` + `TextEncoder` kullan.

**Ön koşul — Web vitest config kontrolü:**
`apps/web` dizininde `vitest.config.ts` yoksa oluştur:

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Ön koşul — apps/web/src/test-setup.ts yoksa oluştur:**

```typescript
// apps/web/src/test-setup.ts
import '@testing-library/jest-dom'
```

**Ön koşul — apps/web/package.json'a script ekle:**
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Ana test dosyası:**

```typescript
// apps/web/src/hooks/use-ai.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
}))

import { useSuggestQuery, useExplainQuery, useFixQuery } from './use-ai'

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function makeJsonChunk(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

describe('useSuggestQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with empty text and not streaming', () => {
    const { result } = renderHook(() => useSuggestQuery())
    expect(result.current.state.text).toBe('')
    expect(result.current.state.isStreaming).toBe(false)
    expect(result.current.state.error).toBeNull()
  })

  it('accumulates delta chunks and marks done', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SELECT ' }),
      makeJsonChunk({ type: 'delta', text: '1' }),
      makeJsonChunk({ type: 'done' }),
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const { result } = renderHook(() => useSuggestQuery())

    act(() => {
      void result.current.suggest({ prompt: 'Show users', dataSourceId: 'ds-1' })
    })

    await waitFor(() => expect(result.current.state.isStreaming).toBe(false))

    expect(result.current.state.text).toBe('SELECT 1')
    expect(result.current.state.error).toBeNull()
  })

  it('sets error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    expect(result.current.state.error).toMatch(/network/i)
    expect(result.current.state.isStreaming).toBe(false)
  })

  it('sets error on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    )

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    expect(result.current.state.error).toMatch(/401/)
  })

  it('reset clears accumulated text and error', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SQL' }),
      makeJsonChunk({ type: 'done' }),
    ])
    vi.mocked(fetch).mockResolvedValueOnce(new Response(stream, { status: 200 }))

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    act(() => { result.current.reset() })

    expect(result.current.state.text).toBe('')
    expect(result.current.state.error).toBeNull()
  })
})

describe('useExplainQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with null response and not loading', () => {
    const { result } = renderHook(() => useExplainQuery())
    expect(result.current.response).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('fetches explanation and sets response', async () => {
    const payload = { turkish: 'Turkce', english: 'English', model: 'claude-sonnet-4-6' }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useExplainQuery())

    await act(async () => {
      await result.current.explain({ sql: 'SELECT 1' })
    })

    expect(result.current.response?.turkish).toBe('Turkce')
    expect(result.current.response?.english).toBe('English')
    expect(result.current.isLoading).toBe(false)
  })

  it('sets error on API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    )

    const { result } = renderHook(() => useExplainQuery())

    await act(async () => {
      await result.current.explain({ sql: 'SELECT 1' })
    })

    expect(result.current.error).toMatch(/500/)
    expect(result.current.response).toBeNull()
  })
})

describe('useFixQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams fixed SQL and sets text', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SELECT * FROM users' }),
      makeJsonChunk({ type: 'done' }),
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )

    const { result } = renderHook(() => useFixQuery())

    await act(async () => {
      await result.current.fix({ sql: 'SELEC * FROM users', errorMessage: 'syntax error' })
    })

    expect(result.current.state.text).toBe('SELECT * FROM users')
    expect(result.current.state.isStreaming).toBe(false)
  })
})
```

---

## STEP 6 — Frontend: AiAssistantPanel Component Test

**Dosya:** `apps/web/src/components/ai/ai-assistant-panel.test.tsx`

**Strateji:**
- `@testing-library/react` render et.
- `use-ai` hook'larını `vi.mock('@/hooks/use-ai', ...)` ile mock'la.
- `next-intl`'i mock'la: `useTranslations` her key'i kendisi döndürsün.
- Temel render, panel açma, buton durumları, callback çağrısı test et.

**İçerik:**

```typescript
// apps/web/src/components/ai/ai-assistant-panel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockSuggest = vi.fn()
const mockExplain = vi.fn()
const mockFix = vi.fn()
const mockReset = vi.fn()

vi.mock('@/hooks/use-ai', () => ({
  useSuggestQuery: () => ({
    suggest: mockSuggest,
    state: { text: '', isStreaming: false, error: null },
    reset: mockReset,
  }),
  useExplainQuery: () => ({
    explain: mockExplain,
    response: null,
    isLoading: false,
    error: null,
    reset: mockReset,
  }),
  useFixQuery: () => ({
    fix: mockFix,
    state: { text: '', isStreaming: false, error: null },
    reset: mockReset,
  }),
}))

import { AiAssistantPanel } from './ai-assistant-panel'

const defaultProps = {
  dataSourceId: 'ds-1',
  currentSql: 'SELECT * FROM users',
  onApplySql: vi.fn(),
}

describe('AiAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the collapsed toggle trigger button', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: /openPanel/i })
    expect(trigger).toBeDefined()
  })

  it('opens panel on trigger click and shows panel title', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: /openPanel/i })
    fireEvent.click(trigger)
    expect(screen.getByText('panelTitle')).toBeDefined()
  })

  it('shows no-data-source warning when dataSourceId is empty', () => {
    render(<AiAssistantPanel {...defaultProps} dataSourceId="" />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(screen.getByText('noDataSourceWarning')).toBeDefined()
  })

  it('suggest button is disabled when prompt textarea is empty', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const suggestBtn = screen.getByText('suggestButton').closest('button')
    expect(suggestBtn?.disabled).toBe(true)
  })

  it('calls suggest with prompt and dataSourceId when button clicked', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const textareas = screen.getAllByRole('textbox')
    const promptTextarea = textareas[0]
    if (promptTextarea) {
      fireEvent.change(promptTextarea, { target: { value: 'Show all orders' } })
    }

    const suggestBtn = screen.getByText('suggestButton').closest('button')
    if (suggestBtn) fireEvent.click(suggestBtn)

    expect(mockSuggest).toHaveBeenCalledWith({
      prompt: 'Show all orders',
      dataSourceId: 'ds-1',
    })
  })

  it('calls explain with currentSql when explain button clicked', () => {
    render(<AiAssistantPanel {...defaultProps} />)
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)

    const explainBtn = screen.getByText('explainButton').closest('button')
    if (explainBtn) fireEvent.click(explainBtn)

    expect(mockExplain).toHaveBeenCalledWith({ sql: 'SELECT * FROM users' })
  })
})
```

---

## STEP 7 — README.md (Tam Yenileme)

**Dosya:** `README.md` — proje kök dizini. Mevcut içeriği TAMAMEN değiştir.

**İçerik:**

```markdown
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
```

---

## STEP 8 — docs/architecture.md

**Dosya:** `docs/architecture.md` — yoksa oluştur, varsa tamamen değiştir.

**İçerik:**

```markdown
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
```

---

## STEP 9 — ADR Dosyaları

### 9a — docs/adr/001-mssql-only.md

```markdown
# ADR-001: MSSQL-Only Database Driver

**Date:** 2026-05  
**Status:** Accepted  

## Context

DataScriba needs to connect to customer databases. Multiple database engines exist. The primary
target user base for the initial release is enterprise teams running Microsoft SQL Server.

## Decision

Ship with MSSQL-only support using the `mssql` npm package. The driver factory uses a
`DataSourceDriver` interface so future drivers slot in without changing callers.

## Consequences

**Positive:** Faster delivery, focused security review, strong parameterization via `Request.input()`.

**Negative:** PostgreSQL/MySQL users cannot use DataScriba until additional drivers are added.

## Future

Add `PostgresDriver`, `MySqlDriver` implementing:

```typescript
interface DataSourceDriver {
  test(): Promise<boolean>
  listTables(): Promise<TableMeta[]>
  describeTable(name: string): Promise<ColumnMeta[]>
  execute(sql: string, params: unknown[]): Promise<QueryResult>
  close(): Promise<void>
}
```
```

### 9b — docs/adr/002-in-memory-repo.md

```markdown
# ADR-002: In-Memory Repositories (Phases 2–6)

**Date:** 2026-05  
**Status:** Accepted (temporary)  

## Context

Prisma is included in the stack but setting up full DB migrations during early development phases
adds bootstrap complexity. The goal of phases 2–6 is to deliver working business logic.

## Decision

All repositories (`DataSourceRepository`, `ReportRepository`, `ScheduleRepository`) use
in-memory `Map<string, T>` storage during development phases.

## Consequences

**Positive:** Zero DB dependency to boot the API. Repository interface is clean — switching to
Prisma only changes repository implementation, not service or controller code.

**Negative:** Data lost on restart. No advanced queries (pagination, filtering, joins).

## Migration Plan

1. Define `schema.prisma` models.
2. Run `prisma migrate dev`.
3. Replace `Map` store in each repository with `prisma.<model>.<method>()`.
4. Repository interface (`create`, `findAll`, `findById`, `update`, `delete`) stays identical.
```

### 9c — docs/adr/003-csv-excel-only.md

```markdown
# ADR-003: CSV and Excel Export Formats Only

**Date:** 2026-05  
**Status:** Accepted  

## Context

Formats considered: CSV, Excel, PDF, Word, HTML. PDF via Puppeteer requires a ~200 MB Chromium
binary. Word/HTML add dependencies. Phase 3 prioritized speed and small Docker images.

## Decision

Phase 3 ships CSV and Excel (.xlsx) only. The `ReportRenderer` interface makes new formats
additive:

```typescript
interface ReportRenderer {
  readonly format: ExportFormat
  render(data: ReportData, options: RenderOptions): Promise<Buffer>
}
```

## Consequences

**Positive:** Lean Docker images, small dependencies (ExcelJS + PapaParse), machine-readable outputs.

**Negative:** No print-ready PDF in Phase 3.

## Future

Phase 9+: `PdfRenderer` via Puppeteer, `WordRenderer` via `docx` package.
```

---

## STEP 10 — CONTRIBUTING.md

**Dosya:** `CONTRIBUTING.md` — proje kök dizini. Yoksa oluştur, varsa tamamen değiştir.

**İçerik:**

```markdown
# Contributing to DataScriba

## Development Environment

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 LTS |
| pnpm | 9+ |
| Docker | 24+ |
| Docker Compose | v2 |

### Setup

```bash
git clone https://github.com/your-org/datascriba.git
cd datascriba
pnpm install
cp .env.example .env
# Edit .env — set ENCRYPTION_MASTER_KEY and ANTHROPIC_API_KEY

docker compose -f docker/docker-compose.yml up postgres redis -d

# In separate terminals:
pnpm --filter=api dev
pnpm --filter=worker dev
pnpm --filter=web dev
```

## Multi-Agent Workflow

This project uses a 4-agent AI pipeline:

```
planner -> [user gate] -> builder -> reviewer -> tester -> done
```

| Agent | Responsibility |
|-------|---------------|
| planner | Analysis, task decomposition, TASK_PLAN.md |
| builder | TypeScript implementation |
| reviewer | Quality, security, correctness review |
| tester | Test coverage verification |

Key files: `TASK_PLAN.md` (planner), `PHASE_X_PROGRESS.md` (builder), `REVIEW.md` (reviewer), `TEST_REPORT.md` (tester).

## Code Standards

- TypeScript strict mode — no `any`, no `var`
- `console.log` banned — use Pino logger
- Named exports everywhere (Next.js page defaults excepted)
- Never swallow errors — log and re-throw
- Naming: `kebab-case` files, `PascalCase` classes, `camelCase` functions, `SCREAMING_SNAKE_CASE` constants

## Running Tests

```bash
pnpm test                         # All tests
pnpm test:coverage                # With coverage (target: 80%+)
pnpm --filter=api test            # API unit tests
pnpm --filter=api test:e2e        # API integration tests
pnpm --filter=report-engine test  # Package tests
```

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add PostgreSQL driver
fix: prevent path traversal in report output
chore: upgrade ExcelJS
docs: update architecture diagram
test: add csv-renderer edge cases
BREAKING: rename ExportFormat
```

## PR Rules

1. Every PR must include tests — reviewer will reject without coverage.
2. Branch from `develop`, not `main`.
3. Branch naming: `feat/<desc>`, `fix/<issue>`, `chore/<task>`.
4. PR title follows Conventional Commits.
5. Include: what changed and why, how to test, breaking changes flagged.
6. Do not merge your own PR.

## Architecture Decision Records

For decisions affecting DB strategy, new heavy dependencies, API breaking changes, or security
logic — create `docs/adr/00N-short-title.md` before implementing.
```

---

## STEP 11 — docs/api.md

**Dosya:** `docs/api.md` — yoksa oluştur, varsa tamamen değiştir.

**İçerik:**

```markdown
# DataScriba API Reference

Base URL: `http://localhost:3001/api/v1`  
Interactive docs: `http://localhost:3001/api/docs` (Swagger UI)

---

## Data Sources

### POST /data-sources

Create a data source.

**Request:**
```json
{
  "name": "Production MSSQL",
  "type": "mssql",
  "host": "db.example.com",
  "port": 1433,
  "database": "sales",
  "username": "reporter",
  "password": "s3cret",
  "encrypt": true,
  "trustServerCertificate": false,
  "connectionTimeoutMs": 30000
}
```

**Response 201:**
```json
{
  "id": "ds-uuid",
  "name": "Production MSSQL",
  "type": "mssql",
  "host": "db.example.com",
  "port": 1433,
  "database": "sales",
  "username": "reporter",
  "encryptedConnectionString": "[REDACTED]",
  "workspaceId": "default",
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z"
}
```

### GET /data-sources

List all data sources (passwords always redacted).

### GET /data-sources/:id

Get one data source. **404** if not found.

### PATCH /data-sources/:id

Update. All fields optional.

### DELETE /data-sources/:id

**204** on success. **404** if not found.

### POST /data-sources/:id/test

Test database connection.

**Response 200:** `{ "success": true }` or `{ "success": false, "error": "..." }`

### GET /data-sources/:id/tables

**Response 200:** `[{ "schema": "dbo", "name": "users", "type": "TABLE" }]`

### GET /data-sources/:id/tables/:tableName/columns

**Response 200:** `[{ "name": "id", "dataType": "int", "nullable": false, "isPrimaryKey": true, "defaultValue": null }]`

---

## Reports

### POST /reports

Create a report definition.

**Request:**
```json
{
  "name": "Monthly Sales",
  "dataSourceId": "ds-uuid",
  "query": "SELECT region, SUM(amount) AS total FROM sales WHERE month = {{month}} GROUP BY region",
  "exportFormats": ["csv", "excel"],
  "parameters": [
    { "name": "month", "type": "string", "label": "Month", "required": true }
  ]
}
```

**Response 201:** ReportDefinition.

### GET /reports

List all reports.

### GET /reports/:id

Get one report. **404** if not found.

### PATCH /reports/:id

Update. All fields optional.

### DELETE /reports/:id

**204** on success.

### POST /reports/:id/run

Execute report synchronously. Returns file as binary.

**Request:** `{ "format": "csv", "parameters": { "month": "2026-05" } }`

**Response 200:**
- CSV: `Content-Type: text/csv; charset=utf-8`
- Excel: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<report-name>-<runId>.<ext>"`
- Body: raw file bytes

**Errors:** 400 invalid format, 400 missing required parameters, 404 report not found.

### GET /reports/:id/runs

Run history for a report.

**Response 200:**
```json
[{
  "id": "run-uuid",
  "reportId": "rpt-uuid",
  "status": "completed",
  "format": "csv",
  "parameters": {},
  "startedAt": "2026-05-16T10:00:00.000Z",
  "completedAt": "2026-05-16T10:00:02.000Z"
}]
```

### GET /reports/:id/runs/:runId

Get single run record.

---

## Schedules

### POST /schedules

Create a schedule. `cronExpression` validated by `cron-parser` — invalid expressions return 400.

**Request:**
```json
{
  "reportId": "rpt-uuid",
  "cronExpression": "0 9 * * 1",
  "format": "excel",
  "enabled": true,
  "notifyEmail": "manager@company.com"
}
```

**Response 201:** ScheduleDefinition.

### GET /schedules

List all schedules.

### GET /schedules/:id

Get one schedule.

### PATCH /schedules/:id

Update. All fields optional.

### DELETE /schedules/:id

**204** on success.

### POST /schedules/:id/trigger

Manually enqueue a BullMQ job immediately.

**Response 200:** `{ "jobId": "bullmq-job-id" }`

---

## AI (Scriba AI)

All AI endpoints rate-limited (default: 10 RPM per IP, configurable via `AI_RATE_LIMIT_RPM`).

### POST /ai/suggest-query

**Content-Type (response):** `text/event-stream`

**Request:** `{ "prompt": "Show total sales per region", "dataSourceId": "ds-uuid" }`

**SSE events:**
```
data: {"type":"delta","text":"SELECT "}
data: {"type":"delta","text":"region"}
data: {"type":"done"}
```

| Event type | Fields | Meaning |
|-----------|--------|---------|
| `delta` | `text: string` | SQL token chunk |
| `done` | — | Stream complete |
| `error` | `error: string` | Error occurred |

### POST /ai/explain-query

Non-streaming. Explains SQL in Turkish and English.

**Request:** `{ "sql": "SELECT * FROM users" }`

**Response 200:**
```json
{
  "turkish": "Bu sorgu tum kullanicilari getirir.",
  "english": "This query retrieves all users.",
  "model": "claude-sonnet-4-6"
}
```

### POST /ai/fix-query

**Content-Type (response):** `text/event-stream`

**Request:** `{ "sql": "SELEC * FORM users", "errorMessage": "Incorrect syntax near SELEC" }`

Same SSE format as `suggest-query`.

---

## Health

### GET /health

**Response 200:** `{ "status": "ok", "timestamp": "2026-05-16T10:00:00.000Z" }`
```

---

## STEP 12 — docs/deployment.md

**Dosya:** `docs/deployment.md` — yoksa oluştur, varsa tamamen değiştir.

**İçerik:**

```markdown
# DataScriba Deployment Guide

## Quick Deploy

```bash
git clone https://github.com/your-org/datascriba.git
cd datascriba
cp .env.example .env
# Edit .env (see Environment Variables below)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d
curl http://localhost:3001/health
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL |
| `REDIS_HOST` | Yes | `127.0.0.1` | Redis host |
| `REDIS_PORT` | Yes | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password (required in production) |
| `ENCRYPTION_MASTER_KEY` | Yes | — | 64-char hex (32 bytes). `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `AI_MODEL` | No | `claude-sonnet-4-6` | Claude model ID |
| `AI_RATE_LIMIT_RPM` | No | `10` | AI rate limit (req/min/IP) |
| `API_PORT` | No | `3001` | API listen port |
| `NODE_ENV` | No | `development` | Set to `production` for prod |
| `BETTER_AUTH_SECRET` | Yes | — | 32+ char random string |
| `BETTER_AUTH_URL` | Yes | — | Public API URL |
| `NEXT_PUBLIC_API_URL` | Yes | — | Browser-facing API URL |
| `INTERNAL_API_URL` | Yes | `http://localhost:3001` | Worker-to-API URL |
| `SMTP_HOST` | No | — | SMTP host for notifications |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | Notification from address |

### Generating ENCRYPTION_MASTER_KEY

```bash
openssl rand -hex 32
```

Output is a 64-character hex string. Copy to `.env`.

**CRITICAL:** Changing this key after creating data sources makes existing connection strings
unreadable. Back up the key in a secrets manager.

## Healthcheck Endpoints

| Endpoint | Method | Expected |
|----------|--------|---------|
| `/health` | GET | `200 {"status":"ok"}` |

Docker uses `wget -qO- http://localhost:3001/health` with 30s interval.

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `ENCRYPTION_MASTER_KEY` is a fresh value (not the example)
- [ ] `REDIS_PASSWORD` is strong and set
- [ ] `BETTER_AUTH_SECRET` is random and long
- [ ] `ANTHROPIC_API_KEY` is valid
- [ ] HTTPS termination via reverse proxy (nginx, Caddy, Traefik)
- [ ] Firewall: only expose ports 3000 (web) and 3001 (API) externally
- [ ] Docker volumes backed up regularly (postgres_data, redis_data, report_output)

## Updating

```bash
git pull
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --no-deps api worker
```

## Logs

```bash
docker compose logs -f api
docker compose logs -f worker
```
```

---

## STEP 13 — docker/docker-compose.prod.yml

**Dosya:** `docker/docker-compose.prod.yml` — YENİ DOSYA.

**İçerik:**

```yaml
# docker/docker-compose.prod.yml
# Production overrides. Use together with docker-compose.yml:
#   docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d
version: '3.9'

services:
  postgres:
    restart: always
    # Do not expose PostgreSQL port externally in production
    ports: []
    deploy:
      resources:
        limits:
          memory: 512m

  redis:
    restart: always
    # Do not expose Redis port externally in production
    ports: []
    deploy:
      resources:
        limits:
          memory: 256m

  api:
    restart: always
    environment:
      NODE_ENV: production
    # No source bind mounts in production — only built image
    volumes: []
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: '1.0'

  worker:
    restart: always
    environment:
      NODE_ENV: production
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: '1.0'
    volumes:
      - report_output:/app/output
```

---

## STEP 14 — Dockerfile Production Stage Güncellemeleri

### apps/api/Dockerfile

Mevcut dosyada `# Production` yorum satırından itibaren dosya sonuna kadar olan bölümü aşağıdakiyle değiştir:

```dockerfile
# Production
FROM node:22-alpine AS production
RUN corepack enable pnpm
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 node

COPY --from=builder --chown=node:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:nodejs /app/packages ./packages
COPY --from=builder --chown=node:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=node:nodejs /app/package.json ./
COPY --from=builder --chown=node:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:nodejs /app/pnpm-lock.yaml ./

# Remove devDependencies to shrink image
RUN pnpm prune --prod --no-optional && \
    rm -rf /root/.cache /root/.local /tmp/*

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "apps/api/dist/main"]
```

### apps/worker/Dockerfile

Mevcut dosyada `# Production` yorum satırından itibaren dosya sonuna kadar olan bölümü aşağıdakiyle değiştir:

```dockerfile
# Production
FROM node:22-alpine AS production
RUN corepack enable pnpm
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 node

COPY --from=builder --chown=node:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=node:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=node:nodejs /app/packages ./packages
COPY --from=builder --chown=node:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=node:nodejs /app/package.json ./
COPY --from=builder --chown=node:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:nodejs /app/pnpm-lock.yaml ./

# Remove devDependencies to shrink image
RUN pnpm prune --prod --no-optional && \
    rm -rf /root/.cache /root/.local /tmp/*

USER node
HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 \
  CMD pgrep -f "node apps/worker/dist/main" || exit 1
CMD ["node", "apps/worker/dist/main"]
```

---

## STEP 15 — .github/workflows/deploy.yml

**Dosya:** `.github/workflows/deploy.yml` — YENİ DOSYA.

**İçerik:**

```yaml
name: Deploy — Production Release

on:
  push:
    tags:
      - 'v*'

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    name: Build and Push Docker Images
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Extract version tag
        id: tag
        run: echo "version=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          target: production
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ steps.tag.outputs.version }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Worker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/worker/Dockerfile
          target: production
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:${{ steps.tag.outputs.version }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/worker:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  create-release:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    needs: build-and-push
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Extract version tag
        id: tag
        run: echo "version=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"

      - name: Generate changelog
        id: changelog
        run: |
          PREV_TAG=$(git tag --sort=-version:refname | sed -n '2p')
          if [ -z "$PREV_TAG" ]; then
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" | head -30)
          else
            CHANGELOG=$(git log "${PREV_TAG}..HEAD" --pretty=format:"- %s (%h)")
          fi
          {
            echo 'changelog<<EOF'
            echo "$CHANGELOG"
            echo 'EOF'
          } >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.tag.outputs.version }}
          name: DataScriba ${{ steps.tag.outputs.version }}
          body: |
            ## DataScriba ${{ steps.tag.outputs.version }}

            ### Docker Images

            ```bash
            docker pull ghcr.io/${{ github.repository }}/api:${{ steps.tag.outputs.version }}
            docker pull ghcr.io/${{ github.repository }}/worker:${{ steps.tag.outputs.version }}
            ```

            ### Changes

            ${{ steps.changelog.outputs.changelog }}

            ### Deployment

            See [docs/deployment.md](docs/deployment.md) for full instructions.
          draft: false
          prerelease: ${{ contains(steps.tag.outputs.version, '-') }}
```

---

## STEP 16 — .env.example Tam Yenileme

Mevcut `.env.example` dosyasını tamamen şununla değiştir:

```bash
# =============================================================================
# DataScriba — Environment Configuration
# Copy to .env and fill in values. NEVER commit .env.
# =============================================================================

# -----------------------------------------------------------------------------
# Database (PostgreSQL)
# -----------------------------------------------------------------------------
DATABASE_URL=postgresql://datascriba:datascriba@localhost:5432/datascriba

# -----------------------------------------------------------------------------
# Redis
# -----------------------------------------------------------------------------
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=        # Required in production

# -----------------------------------------------------------------------------
# Application
# -----------------------------------------------------------------------------
NODE_ENV=development
API_PORT=3001
API_HOST=0.0.0.0

# -----------------------------------------------------------------------------
# Encryption
# Generate with: openssl rand -hex 32
# CRITICAL: Back this up. Changing it makes existing connection strings unreadable.
# -----------------------------------------------------------------------------
ENCRYPTION_MASTER_KEY=change-this-to-64-hex-chars-run-openssl-rand-hex-32-and-paste-here

# -----------------------------------------------------------------------------
# Authentication (Better-Auth)
# Generate with: openssl rand -base64 32
# -----------------------------------------------------------------------------
BETTER_AUTH_SECRET=change-this-to-a-random-32-plus-char-string
BETTER_AUTH_URL=http://localhost:3001

# -----------------------------------------------------------------------------
# Frontend (Next.js) — browser-facing API URL
# -----------------------------------------------------------------------------
NEXT_PUBLIC_API_URL=http://localhost:3001

# -----------------------------------------------------------------------------
# Scriba AI (Anthropic)
# Get key from: https://console.anthropic.com/
# -----------------------------------------------------------------------------
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6
AI_RATE_LIMIT_RPM=10

# -----------------------------------------------------------------------------
# Worker
# -----------------------------------------------------------------------------
INTERNAL_API_URL=http://localhost:3001

# -----------------------------------------------------------------------------
# SMTP (optional — report email notifications)
# -----------------------------------------------------------------------------
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=notifications@example.com
# SMTP_PASS=your-smtp-password
# SMTP_FROM=no-reply@datascriba.io
```

---

## STEP 17 — CI ve E2E Config

### 17a — apps/api/vitest.e2e.config.ts (YENİ DOSYA)

```typescript
// apps/api/vitest.e2e.config.ts
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'node_modules/**', '**/*.e2e-spec.ts'],
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
    }),
  ],
})
```

### 17b — apps/api/package.json script ekleme

`apps/api/package.json` dosyasında `"scripts"` objesine şu satırı ekle:

```json
"test:e2e": "vitest run --config vitest.e2e.config.ts"
```

### 17c — .github/workflows/ci.yml job ekleme

Mevcut `ci.yml` dosyasında son job'dan (`test:` satırının closure'u) sonra, aynı hizayla yeni bir job ekle:

```yaml
  integration-tests:
    name: Integration Tests (E2E)
    runs-on: ubuntu-latest
    env:
      NODE_ENV: test
      REDIS_HOST: 127.0.0.1
      REDIS_PORT: 6379
      ENCRYPTION_MASTER_KEY: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      ANTHROPIC_API_KEY: test-key
      AI_MODEL: claude-sonnet-4-6
      AI_RATE_LIMIT_RPM: 100
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared packages
        run: |
          pnpm --filter=@datascriba/tsconfig build || true
          pnpm --filter=@datascriba/shared-types build || true
          pnpm --filter=@datascriba/queue-config build || true
          pnpm --filter=@datascriba/db-drivers build || true
          pnpm --filter=@datascriba/report-engine build || true
          pnpm --filter=@datascriba/ai-client build || true

      - name: Run API integration tests
        run: pnpm --filter=api test:e2e

      - name: Upload integration test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-coverage
          path: 'apps/api/coverage/**'
          retention-days: 7
```

---

## STEP 18 — Swagger Dekoratör Denetimi ve Tamamlama

### Kontrol listesi (her controller için)

Builder her controller dosyasını açacak ve eksik dekoratörleri ekleyecek:

| Controller dosyası | Kontrol |
|-------------------|--------|
| `apps/api/src/modules/data-source/data-source.controller.ts` | Her method: `@ApiOperation({ summary: '...' })` + `@ApiResponse({ status: X, description: '...' })` |
| `apps/api/src/modules/report/report.controller.ts` | Aynı |
| `apps/api/src/modules/schedule/schedule.controller.ts` | Aynı |
| `apps/api/src/modules/ai/ai.controller.ts` | SSE metodlara `@ApiProduces('text/event-stream')` ekle |

### AI Controller eklenmesi gereken import ve dekoratörler

`apps/api/src/modules/ai/ai.controller.ts` dosyasında:

1. Import satırına `ApiProduces` ekle:
```typescript
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger'
```

2. `suggestQuery` metoduna `@ApiProduces` ekle:
```typescript
@Sse('suggest-query')
@ApiOperation({ summary: 'Generate SQL from natural language (streaming SSE)' })
@ApiBody({ type: SuggestQueryDto })
@ApiProduces('text/event-stream')
@ApiOkResponse({
  description: 'SSE stream. Events: {"type":"delta","text":"..."} or {"type":"done"}',
  schema: { type: 'string' },
})
suggestQuery(@Body() dto: SuggestQueryDto): Observable<MessageEvent> {
```

3. `fixQuery` metoduna aynı pattern'ı uygula:
```typescript
@Sse('fix-query')
@ApiOperation({ summary: 'Fix a broken SQL query (streaming SSE)' })
@ApiBody({ type: FixQueryDto })
@ApiProduces('text/event-stream')
@ApiOkResponse({
  description: 'SSE stream of corrected SQL tokens',
  schema: { type: 'string' },
})
fixQuery(@Body() dto: FixQueryDto): Observable<MessageEvent> {
```

---

## Uygulama Sırası

```
STEP 1  → apps/api/src/modules/data-source/data-source.e2e-spec.ts  (YENİ)
STEP 2  → apps/api/src/modules/report/report.e2e-spec.ts             (YENİ)
STEP 3  → apps/api/src/modules/schedule/schedule.e2e-spec.ts         (YENİ)
STEP 4  → apps/api/src/modules/ai/ai.e2e-spec.ts                     (YENİ)
STEP 5  → apps/web/src/hooks/use-ai.test.ts                          (YENİ)
          apps/web/vitest.config.ts                                   (YENİ — yoksa)
          apps/web/src/test-setup.ts                                  (YENİ — yoksa)
STEP 6  → apps/web/src/components/ai/ai-assistant-panel.test.tsx     (YENİ)
STEP 7  → README.md                                                   (TAM YENİLEME)
STEP 8  → docs/architecture.md                                        (YENİ/YENİLEME)
STEP 9a → docs/adr/001-mssql-only.md                                 (YENİ)
STEP 9b → docs/adr/002-in-memory-repo.md                             (YENİ)
STEP 9c → docs/adr/003-csv-excel-only.md                             (YENİ)
STEP 10 → CONTRIBUTING.md                                             (YENİ/YENİLEME)
STEP 11 → docs/api.md                                                 (YENİ/YENİLEME)
STEP 12 → docs/deployment.md                                          (YENİ/YENİLEME)
STEP 13 → docker/docker-compose.prod.yml                             (YENİ)
STEP 14 → apps/api/Dockerfile  (production stage değişimi)
          apps/worker/Dockerfile (production stage değişimi)
STEP 15 → .github/workflows/deploy.yml                               (YENİ)
STEP 16 → .env.example                                               (TAM YENİLEME)
STEP 17 → apps/api/vitest.e2e.config.ts                              (YENİ)
          apps/api/package.json  (test:e2e script ekleme)
          .github/workflows/ci.yml  (integration-tests job ekleme)
STEP 18 → apps/api/src/modules/ai/ai.controller.ts  (ApiProduces ekle)
          + diğer controller'lar denetim
```

---

## Dokunulmayacak Dosyalar

Aşağıdaki test dosyaları zaten mevcut ve geçiyor — üzerine yazma:

- `packages/report-engine/src/parameters.spec.ts`
- `packages/report-engine/src/renderers/csv.renderer.spec.ts`
- `packages/report-engine/src/renderers/excel.renderer.spec.ts`
- `packages/db-drivers/src/crypto.spec.ts`
- `packages/db-drivers/src/query-guard.spec.ts`

---

## Coverage Doğrulama (Son Adım)

Builder tüm adımları tamamladıktan sonra:

```bash
# Package coverage
pnpm --filter=@datascriba/report-engine test:coverage
pnpm --filter=@datascriba/db-drivers test:coverage

# API unit + e2e
pnpm --filter=api test:coverage
pnpm --filter=api test:e2e

# Web
pnpm --filter=web test
```

Her birinde `Statements: >= 80%` görülmeli. Eksikse tester agent ek case ekler.
