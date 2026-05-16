import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard } from '@nestjs/throttler'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { DataSourceService } from '../data-source/data-source.service'
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
      .overrideProvider(ConfigService)
      .useValue({
        get: vi.fn((key: string) => {
          const values: Record<string, string | number> = {
            ANTHROPIC_API_KEY: 'test-key',
            AI_MODEL: 'claude-sonnet-4-6',
          }
          return values[key]
        }),
      })
      .overrideProvider(DataSourceService)
      .useValue({
        listTables: vi.fn(async () => []),
        describeTable: vi.fn(async () => []),
        executeQuery: vi.fn(),
        findOne: vi.fn(),
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  describe('POST /ai/explain-query', () => {
    it('returns explanation in turkish and english', async () => {
      // sql must be >= 10 chars; NestJS POST endpoints default to 201
      const res = await request(app.getHttpServer())
        .post('/ai/explain-query')
        .send({ sql: 'SELECT * FROM users' })

      // POST defaults to 201 in NestJS unless @HttpCode(200) is set
      expect([200, 201]).toContain(res.status)
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

    it('returns 400 when sql is too short (< 10 chars)', async () => {
      await request(app.getHttpServer())
        .post('/ai/explain-query')
        .send({ sql: 'SELECT 1' })
        .expect(400)
    })

  })

  describe('GET /ai/suggest-query (SSE endpoint)', () => {
    it('responds to GET request for SSE stream', async () => {
      // @Sse decorator registers routes as GET in NestJS by default.
      // The endpoint streams SSE data, so we verify it responds (not 404/405).
      const res = await request(app.getHttpServer())
        .get('/ai/suggest-query')
        .set('Accept', 'text/event-stream')
        .buffer(true)
        .parse((res, callback) => {
          let data = ''
          res.on('data', (chunk: Buffer) => { data += chunk.toString() })
          res.on('end', () => callback(null, data))
        })

      // Should respond with a stream, not 404 or 405
      expect([200, 400, 422]).toContain(res.status)
    })
  })

  describe('GET /ai/fix-query (SSE endpoint)', () => {
    it('responds to GET request for SSE stream', async () => {
      const res = await request(app.getHttpServer())
        .get('/ai/fix-query')
        .set('Accept', 'text/event-stream')
        .buffer(true)
        .parse((res, callback) => {
          let data = ''
          res.on('data', (chunk: Buffer) => { data += chunk.toString() })
          res.on('end', () => callback(null, data))
        })

      // Should respond with a stream, not 404 or 405
      expect([200, 400, 422]).toContain(res.status)
    })
  })
})
