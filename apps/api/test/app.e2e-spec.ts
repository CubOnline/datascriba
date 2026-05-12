import { INestApplication, ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test, TestingModule } from '@nestjs/testing'
import supertest from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { AppModule } from '../src/app.module'

describe('AppController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    )

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )

    await app.init()
    await (app.getHttpAdapter().getInstance() as { ready: () => Promise<void> }).ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const response = await supertest(app.getHttpServer())
        .get('/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'ok',
        version: '0.1.0',
      })

      const timestamp: unknown = (response.body as Record<string, unknown>).timestamp
      expect(typeof timestamp).toBe('string')
      expect(new Date(timestamp as string).toISOString()).toBe(timestamp)
    })
  })
})
