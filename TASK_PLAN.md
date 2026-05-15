# TASK_PLAN.md — Faz 6: Scheduler & Dağıtım

**Üretildi:** 2026-05-15
**Üreten Ajan:** planner
**Hedef Faz:** Faz 6 — Scheduler & Dağıtım
**Durum:** Builder implementasyonu için hazır

---

## Genel Bakış

Bu plan; BullMQ tabanlı asenkron rapor kuyruğu, schedule yönetimi modülü, ayrı bir worker uygulaması, e-posta bildirimleri, schedule UI ve Docker/CI-CD altyapısı olmak üzere altı büyük bileşeni kapsar. Adımlar bağımlılık sırasına göre dizilmiştir — builder adım atlayamaz.

### Yeni Paket & Uygulama Listesi

| Bileşen | Tür | Konum |
|---------|-----|-------|
| `@datascriba/queue-config` | Shared package | `packages/queue-config/` |
| `@datascriba/worker` | NestJS app | `apps/worker/` |
| Schedule module | API modülü | `apps/api/src/modules/schedule/` |
| Schedule UI | Next.js sayfası | `apps/web/src/app/[locale]/schedules/` |
| Docker compose | DevOps | `docker/` |
| GitHub Actions | CI/CD | `.github/workflows/` |

---

## STEP 1 — Shared Queue Config Paketi

**Amaç:** BullMQ bağlantı konfigürasyonunu ve job payload Zod şemasını tüm uygulamalar arasında paylaşmak.
**Bağımlılıklar:** Yok (ilk adım)

### 1.1 — `packages/queue-config/package.json`

```json
{
  "name": "@datascriba/queue-config",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\""
  },
  "dependencies": {
    "bullmq": "^5.8.0",
    "ioredis": "^5.4.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@datascriba/tsconfig": "workspace:*",
    "@types/node": "^22.10.7",
    "typescript": "^5.5.4"
  }
}
```

### 1.2 — `packages/queue-config/tsconfig.json`

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

### 1.3 — `packages/queue-config/src/index.ts`

```typescript
export { QUEUE_NAME, createQueueOptions, createWorkerOptions } from './queue.config'
export { RunReportJobSchema, type RunReportJobPayload } from './run-report-job.schema'
```

### 1.4 — `packages/queue-config/src/queue.config.ts`

```typescript
import type { QueueOptions, WorkerOptions } from 'bullmq'
import Redis from 'ioredis'

export const QUEUE_NAME = 'report-jobs' as const

interface RedisConfig {
  host: string
  port: number
  password?: string
}

/**
 * Creates a shared IORedis connection instance.
 * Caller is responsible for connection lifecycle.
 */
export function createRedisConnection(config: RedisConfig): Redis {
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required by BullMQ
  })
}

/**
 * BullMQ Queue options — used in apps/api (producer side).
 */
export function createQueueOptions(config: RedisConfig): QueueOptions {
  return {
    connection: createRedisConnection(config),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  }
}

/**
 * BullMQ Worker options — used in apps/worker (consumer side).
 */
export function createWorkerOptions(config: RedisConfig): WorkerOptions {
  return {
    connection: createRedisConnection(config),
    concurrency: 5,
  }
}
```

### 1.5 — `packages/queue-config/src/run-report-job.schema.ts`

```typescript
import { z } from 'zod'

/**
 * Type-safe payload for the RunReport BullMQ job.
 * Both API (producer) and Worker (consumer) import this schema.
 */
export const RunReportJobSchema = z.object({
  scheduleId: z.string().uuid(),
  reportId: z.string().uuid(),
  format: z.enum(['csv', 'excel']),
  parameters: z.record(z.string(), z.unknown()).default({}),
  notifyEmail: z.string().email().optional(),
  triggeredBy: z.enum(['scheduler', 'manual']),
  triggeredAt: z.string().datetime(),
})

export type RunReportJobPayload = z.infer<typeof RunReportJobSchema>
```

---

## STEP 2 — Shared Types Guncellemesi

**Amaç:** `packages/shared-types`'a schedule domaine ait tipleri eklemek.
**Bağımlılıklar:** STEP 1

### 2.1 — `packages/shared-types/src/schedule.ts` (YENİ DOSYA)

```typescript
import type { ExportFormat } from './report'

export interface ScheduleDefinition {
  id: string
  reportId: string
  cronExpression: string
  format: ExportFormat
  parameters: Record<string, unknown>
  enabled: boolean
  notifyEmail?: string
  lastRunAt?: Date
  nextRunAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateScheduleRequest {
  reportId: string
  cronExpression: string
  format: ExportFormat
  parameters?: Record<string, unknown>
  notifyEmail?: string
  enabled?: boolean
}

export interface UpdateScheduleRequest {
  cronExpression?: string
  format?: ExportFormat
  parameters?: Record<string, unknown>
  notifyEmail?: string
  enabled?: boolean
}
```

### 2.2 — `packages/shared-types/src/index.ts` (GUNCELLE)

Mevcut dosyaya tek satir ekle — diger satirlara dokunma:

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
// Faz 6 — Schedule types
export type {
  ScheduleDefinition,
  CreateScheduleRequest,
  UpdateScheduleRequest,
} from './schedule'
```

---

## STEP 3 — API: Schedule Modülü

**Amaç:** `POST /schedules`, `GET /schedules`, `GET /schedules/:id`, `PUT /schedules/:id`, `DELETE /schedules/:id`, `POST /schedules/:id/trigger` endpoint'lerini saglamak ve cron scheduler'i entegre etmek.
**Bağımlılıklar:** STEP 1, STEP 2

### 3.1 — API'ye Yeni Bagımlılıklar

`apps/api/package.json` dosyasının `dependencies` bölümüne ekle:

```json
"@datascriba/queue-config": "workspace:*",
"@nestjs/bullmq": "^10.2.3",
"@nestjs/schedule": "^4.1.0",
"bullmq": "^5.8.0",
"cron-parser": "^4.9.0",
"handlebars": "^4.7.8",
"ioredis": "^5.4.1",
"nodemailer": "^6.9.14"
```

`apps/api/package.json` dosyasının `devDependencies` bölümüne ekle:

```json
"@types/nodemailer": "^6.4.17"
```

**Not:** `@nestjs/bullmq` kullan — `@nestjs/bull` değil. BullMQ v5 ile native uyumlu olan paket budur.

### 3.2 — Env Guncellemesi: `apps/api/src/config/env.ts` (GUNCELLE)

Mevcut `envSchema`'ya su alanları ekle (digerlerine dokunma):

```typescript
// Queue / Redis
REDIS_HOST: z.string().default('127.0.0.1'),
REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
REDIS_PASSWORD: z.string().optional(),

// SMTP (optional — e-posta bildirim ozelligi)
SMTP_HOST: z.string().optional(),
SMTP_PORT: z.coerce.number().int().default(587),
SMTP_USER: z.string().optional(),
SMTP_PASS: z.string().optional(),
SMTP_FROM: z.string().email().optional(),
```

Ayrica `Env` tipini disariya aktaran `env` sabit nesnesinin fallback kismini da guncelle:

```typescript
REDIS_HOST: process.env['REDIS_HOST'] ?? '127.0.0.1',
REDIS_PORT: 6379,
REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
SMTP_HOST: process.env['SMTP_HOST'],
SMTP_PORT: 587,
SMTP_USER: process.env['SMTP_USER'],
SMTP_PASS: process.env['SMTP_PASS'],
SMTP_FROM: process.env['SMTP_FROM'],
```

### 3.3 — `apps/api/src/modules/schedule/dto/create-schedule.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CreateScheduleDto {
  @ApiProperty({ description: 'Report ID to schedule', example: 'uuid' })
  @IsUUID()
  reportId!: string

  @ApiProperty({ description: 'Cron expression (5-part)', example: '0 8 * * 1-5' })
  @IsString()
  @MinLength(9)
  cronExpression!: string

  @ApiProperty({ description: 'Export format', enum: ['csv', 'excel'] })
  @IsIn(['csv', 'excel'])
  format!: 'csv' | 'excel'

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'E-mail for delivery notification' })
  @IsOptional()
  @IsEmail()
  notifyEmail?: string

  @ApiPropertyOptional({ description: 'Start enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
```

### 3.4 — `apps/api/src/modules/schedule/dto/update-schedule.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(9)
  cronExpression?: string

  @ApiPropertyOptional({ enum: ['csv', 'excel'] })
  @IsOptional()
  @IsIn(['csv', 'excel'])
  format?: 'csv' | 'excel'

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  notifyEmail?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
```

### 3.5 — `apps/api/src/modules/schedule/schedule.repository.ts`

```typescript
import { Injectable } from '@nestjs/common'
import type { ScheduleDefinition } from '@datascriba/shared-types'

/**
 * Phase 6 stub: in-memory schedule store.
 * A future phase replaces this with Prisma.
 */
@Injectable()
export class ScheduleRepository {
  private readonly store = new Map<string, ScheduleDefinition>()

  async findAll(): Promise<ScheduleDefinition[]> {
    return [...this.store.values()]
  }

  async findById(id: string): Promise<ScheduleDefinition | null> {
    return this.store.get(id) ?? null
  }

  async findEnabled(): Promise<ScheduleDefinition[]> {
    return [...this.store.values()].filter((s) => s.enabled)
  }

  async create(
    data: Omit<ScheduleDefinition, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ScheduleDefinition> {
    const id = crypto.randomUUID()
    const now = new Date()
    const record: ScheduleDefinition = { ...data, id, createdAt: now, updatedAt: now }
    this.store.set(id, record)
    return record
  }

  async update(
    id: string,
    patch: Partial<Omit<ScheduleDefinition, 'id' | 'createdAt'>>,
  ): Promise<ScheduleDefinition | null> {
    const existing = this.store.get(id)
    if (!existing) return null
    const updated: ScheduleDefinition = { ...existing, ...patch, updatedAt: new Date() }
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}
```

### 3.6 — `apps/api/src/modules/schedule/schedule.service.ts`

```typescript
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Cron } from '@nestjs/schedule'
import type { Queue } from 'bullmq'
import cronParser from 'cron-parser'
import type { ScheduleDefinition } from '@datascriba/shared-types'
import { QUEUE_NAME, type RunReportJobPayload } from '@datascriba/queue-config'

import type { CreateScheduleDto } from './dto/create-schedule.dto'
import type { UpdateScheduleDto } from './dto/update-schedule.dto'
import { ScheduleRepository } from './schedule.repository'

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)

  constructor(
    private readonly repository: ScheduleRepository,
    @InjectQueue(QUEUE_NAME) private readonly reportQueue: Queue,
  ) {}

  /** Validate cron expression using cron-parser */
  private validateCron(expression: string): void {
    try {
      cronParser.parseExpression(expression)
    } catch {
      throw new BadRequestException(`Invalid cron expression: "${expression}"`)
    }
  }

  /** Compute next run date for a cron expression */
  private computeNextRun(expression: string): Date {
    const interval = cronParser.parseExpression(expression)
    return interval.next().toDate()
  }

  async create(dto: CreateScheduleDto): Promise<ScheduleDefinition> {
    this.validateCron(dto.cronExpression)
    const nextRunAt = this.computeNextRun(dto.cronExpression)

    const schedule = await this.repository.create({
      reportId: dto.reportId,
      cronExpression: dto.cronExpression,
      format: dto.format,
      parameters: dto.parameters ?? {},
      enabled: dto.enabled ?? true,
      notifyEmail: dto.notifyEmail,
      nextRunAt,
      lastRunAt: undefined,
    })

    this.logger.log({ scheduleId: schedule.id, reportId: dto.reportId }, 'Schedule created')
    return schedule
  }

  async findAll(): Promise<ScheduleDefinition[]> {
    return this.repository.findAll()
  }

  async findOne(id: string): Promise<ScheduleDefinition> {
    const schedule = await this.repository.findById(id)
    if (!schedule) throw new NotFoundException(`Schedule '${id}' not found`)
    return schedule
  }

  async update(id: string, dto: UpdateScheduleDto): Promise<ScheduleDefinition> {
    await this.findOne(id) // 404 guard

    if (dto.cronExpression !== undefined) {
      this.validateCron(dto.cronExpression)
    }

    const patch: Partial<ScheduleDefinition> = { ...dto }
    if (dto.cronExpression !== undefined) {
      patch.nextRunAt = this.computeNextRun(dto.cronExpression)
    }

    const updated = await this.repository.update(id, patch)
    if (!updated) throw new NotFoundException(`Schedule '${id}' not found`)

    this.logger.log({ scheduleId: id }, 'Schedule updated')
    return updated
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id) // 404 guard
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundException(`Schedule '${id}' not found`)
    this.logger.log({ scheduleId: id }, 'Schedule deleted')
  }

  async trigger(id: string): Promise<{ jobId: string }> {
    const schedule = await this.findOne(id)
    const payload: RunReportJobPayload = {
      scheduleId: schedule.id,
      reportId: schedule.reportId,
      format: schedule.format,
      parameters: schedule.parameters,
      notifyEmail: schedule.notifyEmail,
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    }
    const job = await this.reportQueue.add('run-report', payload)
    this.logger.log({ scheduleId: id, jobId: job.id }, 'Schedule manually triggered')
    return { jobId: String(job.id) }
  }

  /**
   * Runs every minute. Checks all enabled schedules and enqueues jobs
   * whose nextRunAt is in the past.
   */
  @Cron('* * * * *')
  async dispatchDueSchedules(): Promise<void> {
    const enabledSchedules = await this.repository.findEnabled()
    const now = new Date()

    for (const schedule of enabledSchedules) {
      if (schedule.nextRunAt === undefined || schedule.nextRunAt > now) continue

      const payload: RunReportJobPayload = {
        scheduleId: schedule.id,
        reportId: schedule.reportId,
        format: schedule.format,
        parameters: schedule.parameters,
        notifyEmail: schedule.notifyEmail,
        triggeredBy: 'scheduler',
        triggeredAt: now.toISOString(),
      }

      try {
        const job = await this.reportQueue.add('run-report', payload)
        const nextRunAt = this.computeNextRun(schedule.cronExpression)
        await this.repository.update(schedule.id, {
          lastRunAt: now,
          nextRunAt,
        })
        this.logger.log(
          { scheduleId: schedule.id, jobId: job.id, nextRunAt },
          'Dispatched scheduled report job',
        )
      } catch (err: unknown) {
        this.logger.error({ scheduleId: schedule.id, err }, 'Failed to dispatch schedule job')
      }
    }
  }
}
```

### 3.7 — `apps/api/src/modules/schedule/schedule.controller.ts`

```typescript
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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import type { ScheduleDefinition } from '@datascriba/shared-types'

import { CreateScheduleDto } from './dto/create-schedule.dto'
import { UpdateScheduleDto } from './dto/update-schedule.dto'
import { ScheduleService } from './schedule.service'

@ApiTags('Schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiBody({ type: CreateScheduleDto })
  @ApiCreatedResponse({ description: 'Schedule created' })
  async create(@Body() dto: CreateScheduleDto): Promise<ScheduleDefinition> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all schedules' })
  @ApiOkResponse({ description: 'List of schedules' })
  async findAll(): Promise<ScheduleDefinition[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async findOne(@Param('id') id: string): Promise<ScheduleDefinition> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDefinition> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'Schedule deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a schedule (enqueue job)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Job enqueued', schema: { properties: { jobId: { type: 'string' } } } })
  async trigger(@Param('id') id: string): Promise<{ jobId: string }> {
    return this.service.trigger(id)
  }
}
```

### 3.8 — `apps/api/src/modules/schedule/email.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import type { Env } from '../../config/env'

interface ReportEmailOptions {
  to: string
  reportName: string
  ranAt: Date
  format: 'csv' | 'excel'
  attachment: {
    filename: string
    content: Buffer
  }
}

// Inline HTML template — avoids filesystem reads at runtime
const EMAIL_TEMPLATE_SOURCE = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>DataScriba Report</title></head>
<body style="font-family:Inter,sans-serif;color:#0F172A;max-width:600px;margin:auto;padding:24px">
  <h1 style="color:#6366F1;margin-bottom:4px">DataScriba</h1>
  <p style="color:#64748b;margin-top:0">Your AI-powered data scribe</p>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
  <h2>Report Ready: {{reportName}}</h2>
  <p>Your scheduled report has been generated and is attached to this e-mail.</p>
  <table style="border-collapse:collapse;width:100%">
    <tr>
      <td style="padding:8px 0;color:#64748b;width:140px">Report Name</td>
      <td style="padding:8px 0;font-weight:600">{{reportName}}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#64748b">Generated At</td>
      <td style="padding:8px 0">{{ranAt}}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#64748b">Format</td>
      <td style="padding:8px 0;text-transform:uppercase">{{format}}</td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
  <p style="color:#94a3b8;font-size:12px">
    This is an automated message from DataScriba. Do not reply to this e-mail.
  </p>
</body>
</html>
`

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly template: HandlebarsTemplateDelegate
  private readonly transporter: nodemailer.Transporter | null = null

  constructor(private readonly config: ConfigService<Env, true>) {
    this.template = Handlebars.compile(EMAIL_TEMPLATE_SOURCE)

    const smtpHost = config.get('SMTP_HOST', { infer: true })
    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.get('SMTP_PORT', { infer: true }),
        secure: false,
        auth: {
          user: config.get('SMTP_USER', { infer: true }),
          pass: config.get('SMTP_PASS', { infer: true }),
        },
      })
    }
  }

  async sendReportEmail(options: ReportEmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured — skipping email notification')
      return
    }

    const html = this.template({
      reportName: options.reportName,
      ranAt: options.ranAt.toISOString(),
      format: options.format,
    })

    const mimeType =
      options.format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'

    const from = this.config.get('SMTP_FROM', { infer: true })

    await this.transporter.sendMail({
      from: from ?? 'no-reply@datascriba.io',
      to: options.to,
      subject: `[DataScriba] Report Ready: ${options.reportName}`,
      html,
      attachments: [
        {
          filename: options.attachment.filename,
          content: options.attachment.content,
          contentType: mimeType,
        },
      ],
    })

    this.logger.log({ to: options.to, reportName: options.reportName }, 'Report email sent')
  }
}
```

### 3.9 — `apps/api/src/modules/schedule/schedule.module.ts`

```typescript
import { BullMQModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUE_NAME } from '@datascriba/queue-config'

import { ReportModule } from '../report/report.module'

import { EmailService } from './email.service'
import { ScheduleController } from './schedule.controller'
import { ScheduleRepository } from './schedule.repository'
import { ScheduleService } from './schedule.service'

@Module({
  imports: [
    BullMQModule.registerQueue({ name: QUEUE_NAME }),
    ReportModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRepository, EmailService],
  exports: [ScheduleService, EmailService],
})
export class ScheduleModule {}
```

### 3.10 — `apps/api/src/app.module.ts` (TAM GUNCELLENMIS HAL)

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { BullMQModule } from '@nestjs/bullmq'
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule'
import { createQueueOptions } from '@datascriba/queue-config'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import type { Env } from './config/env'
import { AiModule } from './modules/ai/ai.module'
import { DataSourceModule } from './modules/data-source/data-source.module'
import { ReportModule } from './modules/report/report.module'
import { ScheduleModule } from './modules/schedule/schedule.module'
import { HealthController } from './health/health.controller'

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
    NestScheduleModule.forRoot(),
    BullMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createQueueOptions({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
        }),
    }),
    DataSourceModule,
    ReportModule,
    AiModule,
    ScheduleModule,
  ],
  controllers: [AppController, HealthController],
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

## STEP 4 — Worker Uygulaması (apps/worker)

**Amaç:** BullMQ'daki `report-jobs` kuyruğunu tüketen ayri NestJS uygulamasi olusturmak.
**Bagımlılıklar:** STEP 1, STEP 3 (queue-config paketi hazir olmali)

### 4.1 — `apps/worker/package.json`

```json
{
  "name": "@datascriba/worker",
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
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@datascriba/db-drivers": "workspace:*",
    "@datascriba/queue-config": "workspace:*",
    "@datascriba/report-engine": "workspace:*",
    "@datascriba/shared-types": "workspace:*",
    "@nestjs/bullmq": "^10.2.3",
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.15",
    "bullmq": "^5.8.0",
    "handlebars": "^4.7.8",
    "ioredis": "^5.4.1",
    "nodemailer": "^6.9.14",
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
    "@types/nodemailer": "^6.4.17",
    "@types/node": "^22.10.7",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vitest/coverage-v8": "^2.1.9",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "unplugin-swc": "^1.5.9",
    "vitest": "^2.1.9"
  }
}
```

### 4.2 — `apps/worker/tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 4.3 — `apps/worker/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 4.4 — `apps/worker/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  }
}
```

### 4.5 — `apps/worker/src/config/worker-env.ts`

```typescript
import { z } from 'zod'

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  /** URL of the API service — worker uses this to fetch report definitions */
  INTERNAL_API_URL: z.string().url().default('http://localhost:3001'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  /** Master encryption key — needed to decrypt data-source credentials */
  ENCRYPTION_MASTER_KEY: z.string().min(64),
})

export type WorkerEnv = z.infer<typeof workerEnvSchema>

export function validateWorkerEnv(): WorkerEnv {
  const result = workerEnvSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    process.stderr.write(`Worker environment validation failed:\n${formatted}\n`)
    process.exit(1)
  }
  return result.data
}
```

### 4.6 — `apps/worker/src/processors/run-report.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RunReportJobSchema, QUEUE_NAME, type RunReportJobPayload } from '@datascriba/queue-config'

import { EmailService } from '../services/email.service'
import { ReportRunnerService } from '../services/report-runner.service'

@Processor(QUEUE_NAME)
export class RunReportProcessor extends WorkerHost {
  private readonly logger = new Logger(RunReportProcessor.name)

  constructor(
    private readonly reportRunner: ReportRunnerService,
    private readonly emailService: EmailService,
  ) {
    super()
  }

  async process(job: Job<unknown>): Promise<void> {
    // Validate payload at runtime
    const parseResult = RunReportJobSchema.safeParse(job.data)
    if (!parseResult.success) {
      this.logger.error(
        { jobId: job.id, errors: parseResult.error.issues },
        'Invalid job payload — job discarded',
      )
      throw new Error('Invalid RunReportJob payload')
    }

    const payload: RunReportJobPayload = parseResult.data
    this.logger.log(
      { jobId: job.id, scheduleId: payload.scheduleId, reportId: payload.reportId },
      'Processing RunReportJob',
    )

    const { buffer, filename, reportName } = await this.reportRunner.run(payload)

    if (payload.notifyEmail) {
      await this.emailService.sendReportEmail({
        to: payload.notifyEmail,
        reportName,
        ranAt: new Date(payload.triggeredAt),
        format: payload.format,
        attachment: { filename, content: buffer },
      })
    }

    this.logger.log(
      { jobId: job.id, scheduleId: payload.scheduleId, filename },
      'RunReportJob completed',
    )
  }
}
```

**Not:** `@nestjs/bullmq`'da processor `WorkerHost` abstract sınıfını `extend` eder ve `process()` metodunu override eder. `@nestjs/bull`'daki `@Process()` dekoratörü kullanılmaz.

### 4.7 — `apps/worker/src/services/report-runner.service.ts`

```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  renderReport,
  renderTemplate,
  validateParameters,
} from '@datascriba/report-engine'
import type { ExportFormat, ReportDefinition } from '@datascriba/report-engine'
import type { RunReportJobPayload } from '@datascriba/queue-config'
import type { WorkerEnv } from '../config/worker-env'

interface RunOutput {
  buffer: Buffer
  filename: string
  reportName: string
  mimeType: string
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  excel: 'xlsx',
}

const OUTPUT_DIR = path.resolve('./output')

@Injectable()
export class ReportRunnerService {
  private readonly logger = new Logger(ReportRunnerService.name)

  constructor(private readonly config: ConfigService<WorkerEnv, true>) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  }

  /**
   * Fetches report definition from the API service, executes the query,
   * renders the output file, and returns the result buffer.
   *
   * Strategy: Worker calls INTERNAL_API_URL to get the ReportDefinition.
   * This avoids duplicating the report store in the worker process.
   * When Prisma is introduced (future phase), both API and Worker can
   * share the same DB connection instead.
   */
  async run(payload: RunReportJobPayload): Promise<RunOutput> {
    const apiUrl = this.config.get('INTERNAL_API_URL', { infer: true })

    // 1. Fetch report definition
    const reportRes = await fetch(`${apiUrl}/reports/${payload.reportId}`)
    if (!reportRes.ok) {
      throw new Error(
        `Failed to fetch report '${payload.reportId}': ${reportRes.status} ${reportRes.statusText}`,
      )
    }
    // The fetch result shape is verified by the API — trust internal call
    const report = (await reportRes.json()) as ReportDefinition

    // 2. Validate parameters
    let resolvedParams: Record<string, unknown> = {}
    if (report.parameters.length > 0) {
      resolvedParams = validateParameters(report.parameters, payload.parameters)
    }

    // 3. Render SQL template
    const sql = renderTemplate(report.query, resolvedParams)

    // 4. Execute query via internal API run endpoint (no direct DB access in worker)
    // Worker delegates query execution back to the API's /reports/:id/run endpoint.
    // This keeps MSSQL driver configuration centralized in the API.
    const runRes = await fetch(`${apiUrl}/reports/${payload.reportId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/octet-stream' },
      body: JSON.stringify({ format: payload.format, parameters: payload.parameters }),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      throw new Error(`Report run failed: ${runRes.status} — ${errText}`)
    }

    const arrayBuffer = await runRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = FILE_EXTENSIONS[payload.format]
    const safeName = report.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
    const runId = crypto.randomUUID()
    const filename = `${safeName}-${runId}.${ext}`
    const outputPath = path.join(OUTPUT_DIR, filename)

    if (!outputPath.startsWith(OUTPUT_DIR + path.sep)) {
      throw new Error('Invalid output path detected')
    }

    fs.writeFileSync(outputPath, buffer)

    this.logger.log({ reportId: payload.reportId, filename }, 'Report file written by worker')

    return {
      buffer,
      filename,
      reportName: report.name,
      mimeType: MIME_TYPES[payload.format],
    }
  }
}
```

### 4.8 — `apps/worker/src/services/email.service.ts`

Worker'ın email service'i, API'deki ile aynı mantıgı kullanır. `WorkerEnv` tipini kullanması disinda STEP 3.8 ile özdes içeriktedir:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import type { WorkerEnv } from '../config/worker-env'

// EMAIL_TEMPLATE_SOURCE ve ReportEmailOptions STEP 3.8 ile özdes —
// builder STEP 3.8'deki içerigi kopyalar, sadece import satirini degistirir:
// ConfigService<WorkerEnv, true> kullanilir.
```

Dosyanin tam içerigi STEP 3.8 ile aynıdir — builder kod tekrarine ragmen kopyalamalıdır çünkü worker ayri bir NestJS uygulamasıdır.

### 4.9 — `apps/worker/src/worker.module.ts`

```typescript
import { BullMQModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { createWorkerOptions, QUEUE_NAME } from '@datascriba/queue-config'
import type { WorkerEnv } from './config/worker-env'

import { EmailService } from './services/email.service'
import { ReportRunnerService } from './services/report-runner.service'
import { RunReportProcessor } from './processors/run-report.processor'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    BullMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<WorkerEnv, true>) =>
        createWorkerOptions({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
        }),
    }),
    BullMQModule.registerQueue({ name: QUEUE_NAME }),
  ],
  providers: [RunReportProcessor, ReportRunnerService, EmailService],
})
export class WorkerModule {}
```

### 4.10 — `apps/worker/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { validateWorkerEnv } from './config/worker-env'
import { WorkerModule } from './worker.module'

async function bootstrap(): Promise<void> {
  validateWorkerEnv()
  const logger = new Logger('Worker')

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.enableShutdownHooks()

  logger.log('DataScriba Worker started — listening for report jobs')
}

void bootstrap()
```

---

## STEP 5 — Frontend: Schedule UI

**Amaç:** `/schedules` sayfası, schedule CRUD dialog'u ve rapor sayfasına "Zamanla" butonu eklemek.
**Bagımlılıklar:** STEP 2, STEP 3 (API endpoint'leri çalısır durumda olmali)

### 5.1 — `apps/web/src/hooks/use-schedules.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ScheduleDefinition, CreateScheduleRequest, UpdateScheduleRequest } from '@datascriba/shared-types'
import { apiClient } from '@/lib/api-client'

const QUERY_KEY = ['schedules'] as const

export function useSchedules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<ScheduleDefinition[]>('/schedules'),
  })
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => apiClient.get<ScheduleDefinition>(`/schedules/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateScheduleRequest) =>
      apiClient.post<ScheduleDefinition>('/schedules', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateSchedule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateScheduleRequest) =>
      apiClient.put<ScheduleDefinition>(`/schedules/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useTriggerSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ jobId: string }>(`/schedules/${id}/trigger`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useToggleSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.put<ScheduleDefinition>(`/schedules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
```

### 5.2 — `apps/web/src/i18n/messages/en.json` (GUNCELLE)

Mevcut JSON'a `"schedule"` anahtarını ekle. Diger anahtarlara dokunma:

```json
"schedule": {
  "title": "Schedules",
  "createNew": "New Schedule",
  "editTitle": "Edit Schedule",
  "report": "Report",
  "cronExpression": "Cron Expression",
  "cronPreview": "Next run",
  "format": "Export Format",
  "notifyEmail": "Notification Email",
  "notifyEmailPlaceholder": "reports@company.com",
  "enabled": "Enabled",
  "lastRunAt": "Last Run",
  "nextRunAt": "Next Run",
  "trigger": "Run Now",
  "triggered": "Job enqueued",
  "deleteConfirm": "Are you sure you want to delete this schedule?",
  "noSchedules": "No schedules yet. Create one to automate your reports.",
  "scheduleReport": "Schedule",
  "invalidCron": "Invalid cron expression"
}
```

### 5.3 — `apps/web/src/i18n/messages/tr.json` (GUNCELLE)

Mevcut Türkçe JSON'a `"schedule"` anahtarını ekle:

```json
"schedule": {
  "title": "Zamanlamalar",
  "createNew": "Yeni Zamanlama",
  "editTitle": "Zamanlama Duzenle",
  "report": "Rapor",
  "cronExpression": "Cron Ifadesi",
  "cronPreview": "Sonraki calisma",
  "format": "Disa Aktarma Formati",
  "notifyEmail": "Bildirim E-postasi",
  "notifyEmailPlaceholder": "raporlar@sirket.com",
  "enabled": "Aktif",
  "lastRunAt": "Son Calisma",
  "nextRunAt": "Sonraki Calisma",
  "trigger": "Simdi Calistir",
  "triggered": "Is kuyruga eklendi",
  "deleteConfirm": "Bu zamanlama silinsin mi?",
  "noSchedules": "Henuz zamanlama yok. Raporlarınızı otomatlastirmak icin bir tane olusturun.",
  "scheduleReport": "Zamanla",
  "invalidCron": "Gecersiz cron ifadesi"
}
```

### 5.4 — `apps/web/src/app/[locale]/schedules/page.tsx`

```typescript
import { useTranslations } from 'next-intl'
import { SchedulesClient } from './schedules-client'

export default function SchedulesPage() {
  const t = useTranslations('schedule')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <SchedulesClient />
    </div>
  )
}
```

### 5.5 — `apps/web/src/app/[locale]/schedules/schedules-client.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Play, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useSchedules,
  useDeleteSchedule,
  useTriggerSchedule,
  useToggleSchedule,
} from '@/hooks/use-schedules'
import { CreateScheduleDialog } from './create-schedule-dialog'

export function SchedulesClient() {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: schedules, isLoading } = useSchedules()
  const deleteMutation = useDeleteSchedule()
  const triggerMutation = useTriggerSchedule()
  const toggleMutation = useToggleSchedule()

  if (isLoading) return <p className="text-muted-foreground">{tc('loading')}</p>

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schedules?.length ?? 0} schedule(s)
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('createNew')}
        </Button>
      </div>

      {schedules?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t('noSchedules')}</p>
      )}

      {schedules && schedules.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('report')}</TableHead>
              <TableHead>{t('cronExpression')}</TableHead>
              <TableHead>{t('format')}</TableHead>
              <TableHead>{t('nextRunAt')}</TableHead>
              <TableHead>{t('lastRunAt')}</TableHead>
              <TableHead>{t('enabled')}</TableHead>
              <TableHead>{tc('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-mono text-xs">{schedule.reportId}</TableCell>
                <TableCell className="font-mono text-xs">{schedule.cronExpression}</TableCell>
                <TableCell className="uppercase text-xs">{schedule.format}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {schedule.nextRunAt
                    ? format(new Date(schedule.nextRunAt), 'yyyy-MM-dd HH:mm')
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {schedule.lastRunAt
                    ? format(new Date(schedule.lastRunAt), 'yyyy-MM-dd HH:mm')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(enabled) =>
                      toggleMutation.mutate({ id: schedule.id, enabled })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => triggerMutation.mutate(schedule.id)}
                      title={t('trigger')}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (window.confirm(t('deleteConfirm'))) {
                          deleteMutation.mutate(schedule.id)
                        }
                      }}
                      title={tc('delete')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
```

### 5.6 — `apps/web/src/app/[locale]/schedules/create-schedule-dialog.tsx`

```typescript
'use client'

import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateSchedule } from '@/hooks/use-schedules'
import { useReports } from '@/hooks/use-reports'

const createScheduleSchema = z.object({
  reportId: z.string().min(1, 'Select a report'),
  cronExpression: z.string().min(9, 'Enter a valid cron expression'),
  format: z.enum(['csv', 'excel']),
  notifyEmail: z.string().email().optional().or(z.literal('')),
})

type CreateScheduleForm = z.infer<typeof createScheduleSchema>

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialReportId?: string
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  initialReportId,
}: CreateScheduleDialogProps) {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const { data: reports } = useReports()
  const createMutation = useCreateSchedule()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateScheduleForm>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: {
      reportId: initialReportId ?? '',
      cronExpression: '0 8 * * 1-5',
      format: 'excel',
    },
  })

  useEffect(() => {
    if (initialReportId) setValue('reportId', initialReportId)
  }, [initialReportId, setValue])

  const onSubmit = useCallback(
    async (data: CreateScheduleForm) => {
      await createMutation.mutateAsync({
        reportId: data.reportId,
        cronExpression: data.cronExpression,
        format: data.format,
        notifyEmail: data.notifyEmail || undefined,
        enabled: true,
      })
      reset()
      onOpenChange(false)
    },
    [createMutation, reset, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('createNew')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Report selector */}
          <div className="space-y-1">
            <Label htmlFor="reportId">{t('report')}</Label>
            <Select
              onValueChange={(val) => setValue('reportId', val)}
              defaultValue={initialReportId}
            >
              <SelectTrigger id="reportId">
                <SelectValue placeholder="Select a report" />
              </SelectTrigger>
              <SelectContent>
                {reports?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.reportId && (
              <p className="text-xs text-destructive">{errors.reportId.message}</p>
            )}
          </div>

          {/* Cron expression */}
          <div className="space-y-1">
            <Label htmlFor="cronExpression">{t('cronExpression')}</Label>
            <Input
              id="cronExpression"
              {...register('cronExpression')}
              placeholder="0 8 * * 1-5"
              className="font-mono text-sm"
            />
            {errors.cronExpression && (
              <p className="text-xs text-destructive">{errors.cronExpression.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              e.g. <code>0 8 * * 1-5</code> = weekdays at 08:00
            </p>
          </div>

          {/* Format */}
          <div className="space-y-1">
            <Label htmlFor="format">{t('format')}</Label>
            <Select
              onValueChange={(val) => setValue('format', val as 'csv' | 'excel')}
              defaultValue="excel"
            >
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notify email */}
          <div className="space-y-1">
            <Label htmlFor="notifyEmail">{t('notifyEmail')}</Label>
            <Input
              id="notifyEmail"
              {...register('notifyEmail')}
              placeholder={t('notifyEmailPlaceholder')}
              type="email"
            />
            {errors.notifyEmail && (
              <p className="text-xs text-destructive">{errors.notifyEmail.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tc('loading') : tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.7 — Sidebar Guncellemesi: `apps/web/src/components/layout/sidebar.tsx` (GUNCELLE)

`navItems` dizisine `schedules` girisini ekle ve `Calendar` ikonunu import et:

```typescript
import { Calendar, Database, FileText, Settings } from 'lucide-react'

const navItems = [
  { href: '/data-sources', icon: Database, labelKey: 'dataSources' },
  { href: '/reports', icon: FileText, labelKey: 'reports' },
  { href: '/schedules', icon: Calendar, labelKey: 'schedules' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
] as const
```

`en.json` ve `tr.json` dosyalarının `nav` namespace'ine de ekle:
- `en.json`: `"schedules": "Schedules"`
- `tr.json`: `"schedules": "Zamanlamalar"`

### 5.8 — Rapor Detay Sayfasına "Zamanla" Butonu

`apps/web/src/app/[locale]/reports/[id]/` altındaki rapor detay istemci bilesenine su eklemeleri yap:

Builder önce mevcut dosyayı okur (`reports/[id]/page.tsx` veya ilgili client bileşeni). Ardından:

```typescript
// Eklenecek import'lar:
import { useState } from 'react'
import { Clock } from 'lucide-react'
import { CreateScheduleDialog } from '../../schedules/create-schedule-dialog'

// Bileşen içine state ekle:
const [scheduleOpen, setScheduleOpen] = useState(false)

// Mevcut "Run Report" butonunun yanına ekle:
<Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
  <Clock className="mr-2 h-4 w-4" />
  {t('scheduleReport')}
</Button>

// JSX'in sonuna ekle (return'den önce değil, return içinde):
<CreateScheduleDialog
  open={scheduleOpen}
  onOpenChange={setScheduleOpen}
  initialReportId={report.id}
/>
```

---

## STEP 6 — DevOps: Docker Compose & Dockerfile

**Amaç:** Tüm servisleri containerize etmek; production ve development için ayri compose dosyaları saglamak.
**Bagımlılıklar:** STEP 4 (worker uygulamasi mevcut olmali)

### 6.1 — `docker/docker-compose.yml` (TAM YENIDEN YAZ)

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

  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: datascriba-api
    restart: unless-stopped
    env_file: ../.env
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      REDIS_PORT: '6379'
    ports:
      - '${API_PORT:-3001}:3001'
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3001/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  worker:
    build:
      context: ..
      dockerfile: apps/worker/Dockerfile
    container_name: datascriba-worker
    restart: unless-stopped
    env_file: ../.env
    environment:
      NODE_ENV: production
      REDIS_HOST: redis
      REDIS_PORT: '6379'
      INTERNAL_API_URL: http://api:3001
    depends_on:
      redis:
        condition: service_healthy
      api:
        condition: service_healthy
    volumes:
      - report_output:/app/output

volumes:
  postgres_data:
  redis_data:
  report_output:
```

### 6.2 — `docker/docker-compose.dev.yml` (YENİ)

```yaml
version: '3.9'

# Development override — mount source for hot reload
# Usage: docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up

services:
  api:
    build:
      target: development
    environment:
      NODE_ENV: development
    volumes:
      - ../apps/api:/app/apps/api
      - ../packages:/app/packages
      - /app/node_modules
    command: pnpm --filter=api dev

  worker:
    build:
      target: development
    environment:
      NODE_ENV: development
    volumes:
      - ../apps/worker:/app/apps/worker
      - ../packages:/app/packages
      - /app/node_modules
    command: pnpm --filter=worker dev
```

### 6.3 — `apps/api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/report-engine/package.json ./packages/report-engine/
COPY packages/db-drivers/package.json ./packages/db-drivers/
COPY packages/ai-client/package.json ./packages/ai-client/
COPY packages/queue-config/package.json ./packages/queue-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Builder
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter=@datascriba/tsconfig build 2>/dev/null || true
RUN pnpm --filter=@datascriba/shared-types build 2>/dev/null || true
RUN pnpm --filter=@datascriba/queue-config build 2>/dev/null || true
RUN pnpm --filter=@datascriba/db-drivers build 2>/dev/null || true
RUN pnpm --filter=@datascriba/report-engine build 2>/dev/null || true
RUN pnpm --filter=@datascriba/ai-client build 2>/dev/null || true
RUN pnpm --filter=@datascriba/api build

# Development
FROM deps AS development
WORKDIR /app
COPY . .
EXPOSE 3001
CMD ["pnpm", "--filter=api", "dev"]

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

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main"]
```

### 6.4 — `apps/worker/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/report-engine/package.json ./packages/report-engine/
COPY packages/db-drivers/package.json ./packages/db-drivers/
COPY packages/queue-config/package.json ./packages/queue-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Builder
FROM deps AS builder
WORKDIR /app
COPY . .
RUN pnpm --filter=@datascriba/tsconfig build 2>/dev/null || true
RUN pnpm --filter=@datascriba/shared-types build 2>/dev/null || true
RUN pnpm --filter=@datascriba/queue-config build 2>/dev/null || true
RUN pnpm --filter=@datascriba/db-drivers build 2>/dev/null || true
RUN pnpm --filter=@datascriba/report-engine build 2>/dev/null || true
RUN pnpm --filter=@datascriba/worker build

# Development
FROM deps AS development
WORKDIR /app
COPY . .
CMD ["pnpm", "--filter=worker", "dev"]

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

USER node
CMD ["node", "apps/worker/dist/main"]
```

### 6.5 — `.env.example` Guncellemesi (root dizininde)

Mevcut dosyaya su bloklari ekle:

```ini
# Queue / Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=

# Worker — Internal API
INTERNAL_API_URL=http://localhost:3001

# SMTP (optional — report email notifications)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=your-password
# SMTP_FROM=no-reply@datascriba.io
```

---

## STEP 7 — CI/CD: GitHub Actions

**Amaç:** Push/PR'da lint + type-check + test; main'e merge sonrasi Docker image build + push.
**Bagımlılıklar:** STEP 6 (Dockerfile'lar mevcut olmali)

### 7.1 — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'

jobs:
  lint-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
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

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      NODE_ENV: test
      REDIS_HOST: 127.0.0.1
      REDIS_PORT: 6379
      ENCRYPTION_MASTER_KEY: 0000000000000000000000000000000000000000000000000000000000000000
      ANTHROPIC_API_KEY: test-key
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
          pnpm --filter=@datascriba/report-engine build || true
          pnpm --filter=@datascriba/db-drivers build || true

      - name: Run tests
        run: pnpm test

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: '**/coverage/**'
          retention-days: 7
```

### 7.2 — `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}/datascriba

jobs:
  build-push:
    name: Build & Push Docker Images
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        app: [api, worker]
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-${{ matrix.app }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push ${{ matrix.app }}
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## STEP 8 — Unit Testler

**Amaç:** Her yeni servis için birim testleri olusturmak.
**Bagımlılıklar:** STEP 3, STEP 4 tamamlanmis olmali

### 8.1 — `apps/api/src/modules/schedule/schedule.service.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { QUEUE_NAME } from '@datascriba/queue-config'
import { ScheduleService } from './schedule.service'
import { ScheduleRepository } from './schedule.repository'

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'job-1' }),
}

const mockRepository = {
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  findEnabled: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('ScheduleService', () => {
  let service: ScheduleService

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: ScheduleRepository, useValue: mockRepository },
        { provide: getQueueToken(QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile()

    service = module.get(ScheduleService)
  })

  describe('create()', () => {
    it('throws BadRequestException for invalid cron', async () => {
      await expect(
        service.create({
          reportId: crypto.randomUUID(),
          cronExpression: 'not-a-cron',
          format: 'csv',
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('creates a schedule with valid cron', async () => {
      const id = crypto.randomUUID()
      mockRepository.create.mockResolvedValueOnce({
        id,
        reportId: crypto.randomUUID(),
        cronExpression: '0 8 * * 1-5',
        format: 'csv',
        parameters: {},
        enabled: true,
        nextRunAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.create({
        reportId: crypto.randomUUID(),
        cronExpression: '0 8 * * 1-5',
        format: 'csv',
      })

      expect(result.id).toBe(id)
    })
  })

  describe('findOne()', () => {
    it('throws NotFoundException when schedule is missing', async () => {
      mockRepository.findById.mockResolvedValueOnce(null)
      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('trigger()', () => {
    it('adds job to queue and returns jobId', async () => {
      const scheduleId = crypto.randomUUID()
      const reportId = crypto.randomUUID()
      mockRepository.findById.mockResolvedValueOnce({
        id: scheduleId,
        reportId,
        cronExpression: '0 8 * * 1-5',
        format: 'csv',
        parameters: {},
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.trigger(scheduleId)
      expect(result.jobId).toBe('job-1')
      expect(mockQueue.add).toHaveBeenCalledWith(
        'run-report',
        expect.objectContaining({ scheduleId, triggeredBy: 'manual' }),
      )
    })
  })

  describe('dispatchDueSchedules()', () => {
    it('enqueues jobs for overdue schedules', async () => {
      const scheduleId = crypto.randomUUID()
      const past = new Date(Date.now() - 60_000)

      mockRepository.findEnabled.mockResolvedValueOnce([
        {
          id: scheduleId,
          reportId: crypto.randomUUID(),
          cronExpression: '* * * * *',
          format: 'excel',
          parameters: {},
          enabled: true,
          nextRunAt: past,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      mockRepository.update.mockResolvedValue({})

      await service.dispatchDueSchedules()

      expect(mockQueue.add).toHaveBeenCalledWith(
        'run-report',
        expect.objectContaining({ scheduleId, triggeredBy: 'scheduler' }),
      )
    })

    it('skips schedules where nextRunAt is in the future', async () => {
      const future = new Date(Date.now() + 3_600_000)
      mockRepository.findEnabled.mockResolvedValueOnce([
        {
          id: crypto.randomUUID(),
          reportId: crypto.randomUUID(),
          cronExpression: '0 0 * * *',
          format: 'csv',
          parameters: {},
          enabled: true,
          nextRunAt: future,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      await service.dispatchDueSchedules()
      expect(mockQueue.add).not.toHaveBeenCalled()
    })
  })
})
```

### 8.2 — `packages/queue-config/src/run-report-job.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { RunReportJobSchema } from './run-report-job.schema'

describe('RunReportJobSchema', () => {
  it('validates a correct payload', () => {
    const payload = {
      scheduleId: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      format: 'csv',
      parameters: { month: '2026-01' },
      notifyEmail: 'user@example.com',
      triggeredBy: 'scheduler',
      triggeredAt: new Date().toISOString(),
    }
    expect(RunReportJobSchema.parse(payload)).toMatchObject({ format: 'csv' })
  })

  it('rejects invalid format', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: crypto.randomUUID(),
        reportId: crypto.randomUUID(),
        format: 'pdf',
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: crypto.randomUUID(),
        reportId: crypto.randomUUID(),
        format: 'excel',
        notifyEmail: 'not-an-email',
        triggeredBy: 'scheduler',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })

  it('defaults parameters to empty object', () => {
    const result = RunReportJobSchema.parse({
      scheduleId: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      format: 'excel',
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    })
    expect(result.parameters).toEqual({})
  })

  it('rejects non-UUID scheduleId', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: 'not-a-uuid',
        reportId: crypto.randomUUID(),
        format: 'csv',
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })
})
```

---

## STEP 9 — Health Check Endpoint (API)

**Amaç:** Worker'ın `depends_on: api condition: service_healthy` çalısabilmesi için API'ye health check eklemek.
**Bagımlılıklar:** STEP 3

### 9.1 — `apps/api/src/health/health.controller.ts` (YENİ)

```typescript
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

interface HealthResponse {
  status: 'ok'
  timestamp: string
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'API health check' })
  @ApiOkResponse({ description: 'Service is healthy' })
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
```

`HealthController`'ın `app.module.ts` `controllers` dizisine eklenmesi STEP 3.10'da gösterildi.

---

## STEP 10 — Turbo & Root Package.json Guncellemeleri

**Amaç:** Root package.json'a yeni script'leri eklemek.
**Bagımlılıklar:** STEP 1, STEP 4

### 10.1 — Root `package.json` scripts (GUNCELLE)

Mevcut `scripts` bölümüne su satirlari ekle:

```json
"docker:dev": "docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d",
"worker:dev": "pnpm --filter=@datascriba/worker dev",
"worker:build": "pnpm --filter=@datascriba/worker build"
```

`turbo.json` — ek degisiklik gerekmez. Mevcut yapilandirma `apps/*` altindaki tüm uygulamalar için otomatik çalisir.

---

## Implementasyon Sirasi (Builder Icin)

Builder bu adımları bagımlılık sirasına göre uygular:

```
STEP 1  (queue-config paketi)
  -> STEP 2  (shared-types güncellemesi)
  -> STEP 9  (health controller)
  -> STEP 3  (API schedule modülü — STEP 9 ile birlikte)
  -> STEP 4  (worker uygulamasi)
  -> STEP 5  (frontend UI)
  -> STEP 6  (Docker)
  -> STEP 7  (CI/CD)
  -> STEP 8  (testler — son adim)
  -> STEP 10 (root package.json)
```

STEP 3 ve STEP 9 paralel uygulanabilir. STEP 5 ve STEP 6 da birbirinden bagimsizdir.

---

## Dosya Degisiklik Ozeti

### Yeni Dosyalar (Toplam: 34)

| Dosya | STEP |
|-------|------|
| `packages/queue-config/package.json` | 1.1 |
| `packages/queue-config/tsconfig.json` | 1.2 |
| `packages/queue-config/src/index.ts` | 1.3 |
| `packages/queue-config/src/queue.config.ts` | 1.4 |
| `packages/queue-config/src/run-report-job.schema.ts` | 1.5 |
| `packages/queue-config/src/run-report-job.schema.spec.ts` | 8.2 |
| `packages/shared-types/src/schedule.ts` | 2.1 |
| `apps/api/src/modules/schedule/dto/create-schedule.dto.ts` | 3.3 |
| `apps/api/src/modules/schedule/dto/update-schedule.dto.ts` | 3.4 |
| `apps/api/src/modules/schedule/schedule.repository.ts` | 3.5 |
| `apps/api/src/modules/schedule/schedule.service.ts` | 3.6 |
| `apps/api/src/modules/schedule/schedule.controller.ts` | 3.7 |
| `apps/api/src/modules/schedule/email.service.ts` | 3.8 |
| `apps/api/src/modules/schedule/schedule.module.ts` | 3.9 |
| `apps/api/src/modules/schedule/schedule.service.spec.ts` | 8.1 |
| `apps/api/src/health/health.controller.ts` | 9.1 |
| `apps/worker/package.json` | 4.1 |
| `apps/worker/tsconfig.json` | 4.2 |
| `apps/worker/tsconfig.build.json` | 4.3 |
| `apps/worker/nest-cli.json` | 4.4 |
| `apps/worker/src/config/worker-env.ts` | 4.5 |
| `apps/worker/src/processors/run-report.processor.ts` | 4.6 |
| `apps/worker/src/services/report-runner.service.ts` | 4.7 |
| `apps/worker/src/services/email.service.ts` | 4.8 |
| `apps/worker/src/worker.module.ts` | 4.9 |
| `apps/worker/src/main.ts` | 4.10 |
| `apps/web/src/hooks/use-schedules.ts` | 5.1 |
| `apps/web/src/app/[locale]/schedules/page.tsx` | 5.4 |
| `apps/web/src/app/[locale]/schedules/schedules-client.tsx` | 5.5 |
| `apps/web/src/app/[locale]/schedules/create-schedule-dialog.tsx` | 5.6 |
| `docker/docker-compose.dev.yml` | 6.2 |
| `apps/api/Dockerfile` | 6.3 |
| `apps/worker/Dockerfile` | 6.4 |
| `.github/workflows/ci.yml` | 7.1 |
| `.github/workflows/deploy.yml` | 7.2 |

### Guncellenen Dosyalar (Toplam: 9)

| Dosya | STEP | Degisiklik |
|-------|------|-----------|
| `packages/shared-types/src/index.ts` | 2.2 | schedule export eklendi |
| `apps/api/src/config/env.ts` | 3.2 | Redis + SMTP env degiskenleri |
| `apps/api/package.json` | 3.1 | BullMQ, nodemailer, handlebars bagımlılıkları |
| `apps/api/src/app.module.ts` | 3.10 | BullMQModule, NestScheduleModule, ScheduleModule, HealthController |
| `apps/web/src/i18n/messages/en.json` | 5.2 | schedule namespace |
| `apps/web/src/i18n/messages/tr.json` | 5.3 | schedule namespace |
| `apps/web/src/components/layout/sidebar.tsx` | 5.7 | schedules nav item + Calendar ikon |
| `apps/web/src/app/[locale]/reports/[id]/page.tsx` | 5.8 | "Zamanla" butonu |
| `docker/docker-compose.yml` | 6.1 | api + worker servisleri eklendi |
| `package.json` (root) | 10.1 | docker:dev, worker:dev, worker:build script'leri |
| `.env.example` | 6.5 | Redis + SMTP degiskenleri |

---

## Potansiyel Riskler & Builder Notlari

1. **`@nestjs/bullmq` vs `@nestjs/bull`:** Plan `@nestjs/bullmq` kullanir. `@nestjs/bull` BullMQ v5 ile tam uyumlu degildir. `InjectQueue` ve `getQueueToken` `@nestjs/bullmq`'dan import edilir. Processor `WorkerHost`'u extend eder, `@Process()` dekoratörü kullanilmaz.

2. **`cron-parser` versiyonu:** `cron-parser@4.x` CommonJS'dir, `NodeNext` module resolution ile uyumludur. `5.x` ESM oldugu için `4.x` tercih edilmelidir.

3. **Worker bağlantisi mimari notu:** Worker ayri bir process oldugu için API'nin in-memory store'una erisemez. Faz 6 çözümü: Worker `INTERNAL_API_URL` üzerinden HTTP ile `/reports/:id/run` çagririr. Bu geçici bir çözümdür — Prisma entegrasyonunda kalicilasir.

4. **`tr.json` dosyasi:** Builder önce dosyanin varlığını kontrol etmeli. Yoksa olusturur, varsa schedule namespace'ini ekler.

5. **Handlebars `HandlebarsTemplateDelegate` tipi:** `@types/handlebars` paketi gerekmez — `handlebars` paketin kendi tip tanımlamalari var (`handlebars/types`). Builder tip hatasinda paketi `@types/handlebars` yerine `handlebars` üzerinden çözmelidir.

6. **Docker Buildx:** CI/CD pipeline'ında `docker/setup-buildx-action` gereklidir. Multi-platform build istenirse `platforms: linux/amd64,linux/arm64` eklenebilir.

7. **`exactOptionalPropertyTypes: true`:** `tsconfig.base.json`'da aktif. `ScheduleDefinition`'daki `lastRunAt?: Date` ve `nextRunAt?: Date` alanlari `undefined` olarak atanirken dikkatli olunmali — `patch.lastRunAt = undefined` yerine `delete patch.lastRunAt` kullanilmasi gerekebilir.

---

## Kabul Kriterleri (Reviewer Icin)

- [ ] `POST /schedules` geçersiz cron expression için `400 Bad Request` döndürür
- [ ] `POST /schedules/:id/trigger` BullMQ kuyruğuna is ekler ve `{ jobId }` döndürür
- [ ] `@Cron('* * * * *')` her dakika çalisir ve süresi geçmis schedule'lari kuyruga gönderir
- [ ] Worker basarisiz job'lari 3 kez exponential backoff ile dener (`attempts: 3, backoff: exponential`)
- [ ] `RunReportJobSchema` geçersiz payload'i reddeder
- [ ] Worker SMTP yapilandirilmissa job tamamlandiginda e-posta gönderir
- [ ] `/schedules` sayfasi schedule'lari listeler ve toggle enable/disable çalisir
- [ ] "Zamanla" butonu rapor ID'si pre-fill edilmis dialog açar
- [ ] CI pipeline lint + type-check + test adimlarini sirasıyla çalistirir
- [ ] Docker build non-root `node` kullanicisıyla çalisir
- [ ] `GET /health` endpoint'i `{ status: "ok" }` döndürür
- [ ] `any` tipi yok, `console.log` yok
- [ ] `ScheduleDefinition` sadece in-memory repository'de tutulur (Prisma migration sonraya birakıldi)

---

*Bu plan builder tarafından bagimsiz olarak uygulanabilir. Herhangi bir adimda belirsizlik varsa builder CLAUDE.md'deki "Soru/Onay Gerektiren Durumlar" bölümünü takip etmelidir.*
