import { createQueueOptions } from '@datascriba/queue-config'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
// Note: @nestjs/bullmq exports BullModule (wraps BullMQ v5)

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import type { Env } from './config/env'
import { HealthController } from './health/health.controller'
import { AiModule } from './modules/ai/ai.module'
import { DataSourceModule } from './modules/data-source/data-source.module'
import { ReportModule } from './modules/report/report.module'
import { ScheduleModule } from './modules/schedule/schedule.module'

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
    BullModule.forRootAsync({
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
