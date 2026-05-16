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
    findAll: vi.fn(async (_workspaceId?: string) => [...reportStore.values()]),
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

  describe('PUT /reports/:id', () => {
    it('updates report name', async () => {
      const created = await request(app.getHttpServer())
        .post('/reports')
        .send(validReportPayload)

      const res = await request(app.getHttpServer())
        .put(`/reports/${created.body.id}`)
        .send({ name: 'Updated Report', dataSourceId: 'ds-1', query: 'SELECT 1', exportFormats: ['csv'] })
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

      // NestJS POST default is 201; controller may not have @HttpCode(200)
      expect([200, 201]).toContain(res.status)
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
