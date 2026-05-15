import { QUEUE_NAME, type RunReportJobPayload } from '@datascriba/queue-config'
import type { ScheduleDefinition } from '@datascriba/shared-types'
import { InjectQueue } from '@nestjs/bullmq'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import type { Queue } from 'bullmq'
import { parseExpression } from 'cron-parser'

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
      parseExpression(expression)
    } catch {
      throw new BadRequestException(`Invalid cron expression: "${expression}"`)
    }
  }

  /** Compute next run date for a cron expression */
  private computeNextRun(expression: string): Date {
    const interval = parseExpression(expression)
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
