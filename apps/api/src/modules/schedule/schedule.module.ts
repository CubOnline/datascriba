import { QUEUE_NAME } from '@datascriba/queue-config'
import { BullModule } from '@nestjs/bullmq'
// Note: @nestjs/bullmq exports BullModule (not BullMQModule)
import { Module } from '@nestjs/common'

import { ReportModule } from '../report/report.module'

import { EmailService } from './email.service'
import { ScheduleController } from './schedule.controller'
import { ScheduleRepository } from './schedule.repository'
import { ScheduleService } from './schedule.service'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAME }),
    ReportModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRepository, EmailService],
  exports: [ScheduleService, EmailService],
})
export class ScheduleModule {}
