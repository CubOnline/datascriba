import { BullModule } from '@nestjs/bullmq'
// Note: @nestjs/bullmq v10 exports BullModule (wraps BullMQ v5)
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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<WorkerEnv, true>) =>
        createWorkerOptions({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
        }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAME }),
  ],
  providers: [RunReportProcessor, ReportRunnerService, EmailService],
})
export class WorkerModule {}
