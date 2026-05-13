import { ParameterValidationError } from '@datascriba/report-engine'
import { NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DataSourceService } from '../data-source/data-source.service'

import { CreateReportDto } from './dto/create-report.dto'
import { RunReportDto } from './dto/run-report.dto'
import { ReportRepository } from './report.repository'
import { ReportService } from './report.service'

// Mock the file system so tests don't write to disk
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

const SAMPLE_QUERY_RESULT = {
  columns: [
    { name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
    { name: 'name', dataType: 'varchar', nullable: true, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
  rowCount: 2,
  durationMs: 10,
}

function makeDataSourceServiceMock() {
  return {
    executeQuery: vi.fn().mockResolvedValue(SAMPLE_QUERY_RESULT),
    findOne: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    testConnection: vi.fn(),
    listTables: vi.fn(),
    describeTable: vi.fn(),
  }
}

describe('ReportService', () => {
  let service: ReportService
  let dataSourceServiceMock: ReturnType<typeof makeDataSourceServiceMock>

  beforeEach(async () => {
    dataSourceServiceMock = makeDataSourceServiceMock()

    const module = await Test.createTestingModule({
      providers: [
        ReportService,
        ReportRepository,
        {
          provide: DataSourceService,
          useValue: dataSourceServiceMock,
        },
      ],
    }).compile()

    service = module.get(ReportService)
  })

  async function createTestReport(): Promise<string> {
    const dto: CreateReportDto = {
      name: 'Test Report',
      dataSourceId: 'ds-123',
      query: 'SELECT * FROM users',
      exportFormats: ['csv', 'excel'],
    }
    const report = await service.create(dto)
    return report.id
  }

  describe('create', () => {
    it('creates a report definition and returns it with an id', async () => {
      const id = await createTestReport()
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })
  })

  describe('findAll', () => {
    it('returns empty array when no reports exist', async () => {
      const reports = await service.findAll()
      expect(reports).toEqual([])
    })

    it('returns created reports', async () => {
      await createTestReport()
      const reports = await service.findAll()
      expect(reports).toHaveLength(1)
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException when report does not exist', async () => {
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException)
    })

    it('returns report when it exists', async () => {
      const id = await createTestReport()
      const report = await service.findOne(id)
      expect(report.id).toBe(id)
      expect(report.name).toBe('Test Report')
    })
  })

  describe('run — CSV', () => {
    it('returns a Buffer with correct mime type for CSV', async () => {
      const id = await createTestReport()
      const dto: RunReportDto = { format: 'csv' }
      const result = await service.run(id, dto)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer.length).toBeGreaterThan(0)
      expect(result.mimeType).toBe('text/csv; charset=utf-8')
      expect(result.filename).toMatch(/\.csv$/)
    })

    it('calls dataSourceService.executeQuery with the rendered SQL', async () => {
      const id = await createTestReport()
      const dto: RunReportDto = { format: 'csv' }
      await service.run(id, dto)
      expect(dataSourceServiceMock.executeQuery).toHaveBeenCalledWith(
        'ds-123',
        'SELECT * FROM users',
        [],
      )
    })
  })

  describe('run — Excel', () => {
    it('returns a Buffer starting with PK magic bytes for Excel', async () => {
      const id = await createTestReport()
      const dto: RunReportDto = { format: 'excel' }
      const result = await service.run(id, dto)

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.buffer[0]).toBe(0x50) // P
      expect(result.buffer[1]).toBe(0x4b) // K
      expect(result.mimeType).toContain('spreadsheetml')
      expect(result.filename).toMatch(/\.xlsx$/)
    })
  })

  describe('run — run record persistence', () => {
    it('saves run record with status completed', async () => {
      const id = await createTestReport()
      await service.run(id, { format: 'csv' })
      const runs = await service.listRuns(id)
      expect(runs).toHaveLength(1)
      expect(runs[0]?.status).toBe('completed')
    })

    it('saves run record with status failed on error', async () => {
      dataSourceServiceMock.executeQuery.mockRejectedValueOnce(new Error('DB error'))
      const id = await createTestReport()

      await expect(service.run(id, { format: 'csv' })).rejects.toThrow('DB error')

      const runs = await service.listRuns(id)
      expect(runs).toHaveLength(1)
      expect(runs[0]?.status).toBe('failed')
      expect(runs[0]?.errorMessage).toBe('DB error')
    })
  })

  describe('run — parameter validation', () => {
    it('throws ParameterValidationError for missing required parameter', async () => {
      const dto: CreateReportDto = {
        name: 'Param Report',
        dataSourceId: 'ds-123',
        query: 'SELECT * FROM {{tableName}}',
        exportFormats: ['csv'],
        parameters: [
          {
            name: 'tableName',
            type: 'string',
            label: 'Table Name',
            required: true,
          },
        ],
      }
      const report = await service.create(dto)

      await expect(
        service.run(report.id, { format: 'csv', parameters: {} }),
      ).rejects.toThrow(ParameterValidationError)
    })

    it('renders query with provided parameters', async () => {
      const dto: CreateReportDto = {
        name: 'Template Report',
        dataSourceId: 'ds-123',
        query: 'SELECT * FROM {{tableName}}',
        exportFormats: ['csv'],
        parameters: [
          {
            name: 'tableName',
            type: 'string',
            label: 'Table Name',
            required: true,
          },
        ],
      }
      const report = await service.create(dto)

      await service.run(report.id, {
        format: 'csv',
        parameters: { tableName: 'orders' },
      })

      expect(dataSourceServiceMock.executeQuery).toHaveBeenCalledWith(
        'ds-123',
        'SELECT * FROM orders',
        [],
      )
    })
  })

  describe('remove', () => {
    it('throws NotFoundException when deleting non-existent report', async () => {
      await expect(service.remove('ghost-id')).rejects.toThrow(NotFoundException)
    })

    it('removes the report successfully', async () => {
      const id = await createTestReport()
      await service.remove(id)
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException)
    })
  })
})
