import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAME } from '@datascriba/queue-config'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataSourceService } from '../data-source/data-source.service'
import { DataSourceRepository } from '../data-source/data-source.repository'
import { ReportRepository } from '../report/report.repository'
import { ReportService } from '../report/report.service'
import { EmailService } from './email.service'
import { ScheduleController } from './schedule.controller'
import { ScheduleRepository } from './schedule.repository'
import { ScheduleService } from './schedule.service'

// Valid UUID v4 for reportId (CreateScheduleDto requires @IsUUID())
const REPORT_UUID = '6ca1a115-787f-48e5-9a52-d75d066dc90a'

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

  // reportId must be a valid UUID (CreateScheduleDto uses @IsUUID())
  const validPayload = {
    reportId: REPORT_UUID,
    cronExpression: '0 9 * * 1',
    format: 'csv',
    enabled: true,
  }

  beforeAll(async () => {
    repoMock = makeScheduleRepoMock()

    // Use a minimal test module that inlines just what we need
    // Avoid ScheduleModule import to prevent BullMQ connection attempt
    const module = await Test.createTestingModule({
      imports: [
        // Register BullModule with a fake Redis URL to satisfy module initialization
        // The queue provider itself is overridden below
        BullModule.forRoot({
          connection: { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 0, enableReadyCheck: false },
        }),
        BullModule.registerQueue({ name: QUEUE_NAME }),
      ],
      controllers: [ScheduleController],
      providers: [
        ScheduleService,
        { provide: ScheduleRepository, useValue: {} },
        { provide: DataSourceService, useValue: {} },
        { provide: ReportService, useValue: {} },
        { provide: ReportRepository, useValue: {} },
        { provide: DataSourceRepository, useValue: {} },
        { provide: EmailService, useValue: { sendReportEmail: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { get: vi.fn((_key: string) => undefined) },
        },
      ],
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

    it('returns 400 when reportId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/schedules')
        .send({ ...validPayload, reportId: 'not-a-uuid' })
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

    it('returns 200 for existing schedule', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      await request(app.getHttpServer())
        .get(`/schedules/${created.body.id}`)
        .expect(200)
    })
  })

  describe('PUT /schedules/:id', () => {
    it('updates enabled flag', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      const res = await request(app.getHttpServer())
        .put(`/schedules/${created.body.id}`)
        .send({ enabled: false })
        .expect(200)

      expect(res.body.enabled).toBe(false)
    })

    it('returns 400 for invalid cron on update', async () => {
      const created = await request(app.getHttpServer())
        .post('/schedules')
        .send(validPayload)

      await request(app.getHttpServer())
        .put(`/schedules/${created.body.id}`)
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

      // NestJS @Post defaults to 201, controller may not have @HttpCode(200)
      const res = await request(app.getHttpServer())
        .post(`/schedules/${created.body.id}/trigger`)

      expect([200, 201]).toContain(res.status)
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
