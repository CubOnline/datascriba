import { QUEUE_NAME } from '@datascriba/queue-config'
import { getQueueToken } from '@nestjs/bullmq'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ScheduleRepository } from './schedule.repository'
import { ScheduleService } from './schedule.service'

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
