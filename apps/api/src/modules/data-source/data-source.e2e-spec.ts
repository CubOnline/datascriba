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
    findAll: vi.fn(async (_workspaceId?: string) => [...store.values()]),
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

  // NOTE: @IsPublicHost() rejects localhost — use a public hostname
  const validPayload = {
    name: 'Test MSSQL',
    type: 'mssql',
    host: 'db.example.com',
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

    it('returns 400 when localhost is used as host (SSRF prevention)', async () => {
      await request(app.getHttpServer())
        .post('/data-sources')
        .send({ ...validPayload, host: 'localhost' })
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

  describe('PUT /data-sources/:id', () => {
    it('updates name and returns updated record', async () => {
      const created = await request(app.getHttpServer())
        .post('/data-sources')
        .send(validPayload)

      const id = created.body.id as string

      const res = await request(app.getHttpServer())
        .put(`/data-sources/${id}`)
        .send({ name: 'Updated Name' })
        .expect(200)

      expect(res.body.name).toBe('Updated Name')
    })

    it('returns 404 when updating non-existent data source', async () => {
      await request(app.getHttpServer())
        .put('/data-sources/ghost')
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
