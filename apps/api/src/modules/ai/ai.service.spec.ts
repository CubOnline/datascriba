import type { AiStreamChunk, AiTextResponse } from '@datascriba/ai-client'
import type { ColumnMeta, TableMeta } from '@datascriba/shared-types'
import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DataSourceService } from '../data-source/data-source.service'

import { AiService } from './ai.service'

// AiClient mock — gercek API cagrisi yapilmaz
const mockSuggestQuery = vi.fn()
const mockExplainQuery = vi.fn()
const mockFixQuery = vi.fn()

vi.mock('@datascriba/ai-client', () => ({
  AiClient: vi.fn().mockImplementation(() => ({
    suggestQuery: mockSuggestQuery,
    explainQuery: mockExplainQuery,
    fixQuery: mockFixQuery,
  })),
}))

const MOCK_TABLES: TableMeta[] = [
  { schema: 'dbo', name: 'Orders', type: 'table' },
]

const MOCK_COLUMNS: ColumnMeta[] = [
  { name: 'Id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
  { name: 'Total', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
]

function makeDataSourceService(): DataSourceService {
  return {
    listTables: vi.fn().mockResolvedValue(MOCK_TABLES),
    describeTable: vi.fn().mockResolvedValue(MOCK_COLUMNS),
  } as unknown as DataSourceService
}

function makeConfigService(): ConfigService {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'ANTHROPIC_API_KEY') return 'test-key'
      if (key === 'AI_MODEL') return 'claude-sonnet-4-6'
      return undefined
    }),
  } as unknown as ConfigService
}

describe('AiService', () => {
  let service: AiService
  let dataSourceService: DataSourceService

  beforeEach(() => {
    vi.clearAllMocks()
    dataSourceService = makeDataSourceService()
    service = new AiService(makeConfigService(), dataSourceService)
    service.onModuleInit()
  })

  describe('suggestQuery', () => {
    it('yields stream chunks from AiClient.suggestQuery', async () => {
      const chunks: AiStreamChunk[] = [
        { type: 'delta', text: 'SELECT' },
        { type: 'delta', text: ' * FROM [dbo].[Orders]' },
        { type: 'done' },
      ]
      mockSuggestQuery.mockImplementation(async function* () {
        for (const c of chunks) yield c
      })

      const result: AiStreamChunk[] = []
      for await (const chunk of service.suggestQuery({
        prompt: 'show all orders',
        dataSourceId: 'ds-1',
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
      expect(dataSourceService.listTables).toHaveBeenCalledWith('ds-1')
      expect(dataSourceService.describeTable).toHaveBeenCalledWith('ds-1', 'dbo.Orders')
    })
  })

  describe('explainQuery', () => {
    it('parses ---TR--- and ---EN--- sections', async () => {
      const mockResponse: AiTextResponse = {
        text: '---TR---\nBu sorgu tum siparisleri dondurur.\n---EN---\nThis query returns all orders.',
        model: 'claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 80,
        cacheReadInputTokens: 0,
      }
      mockExplainQuery.mockResolvedValue(mockResponse)

      const result = await service.explainQuery({ sql: 'SELECT * FROM [dbo].[Orders]' })

      expect(result.turkish).toBe('Bu sorgu tum siparisleri dondurur.')
      expect(result.english).toBe('This query returns all orders.')
      expect(result.model).toBe('claude-sonnet-4-6')
    })

    it('uses full text as turkish if sections are missing', async () => {
      const mockResponse: AiTextResponse = {
        text: 'Plain explanation without sections.',
        model: 'claude-sonnet-4-6',
        inputTokens: 10,
        outputTokens: 5,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      }
      mockExplainQuery.mockResolvedValue(mockResponse)

      const result = await service.explainQuery({ sql: 'SELECT 1' })

      expect(result.turkish).toBe('Plain explanation without sections.')
      expect(result.english).toBe('')
    })
  })

  describe('fixQuery', () => {
    it('yields stream chunks from AiClient.fixQuery', async () => {
      const chunks: AiStreamChunk[] = [
        { type: 'delta', text: 'SELECT * FROM [dbo].[Orders]' },
        { type: 'done' },
      ]
      mockFixQuery.mockImplementation(async function* () {
        for (const c of chunks) yield c
      })

      const result: AiStreamChunk[] = []
      for await (const chunk of service.fixQuery({
        sql: 'SELECT * FORM Orders',
        errorMessage: "Incorrect syntax near 'FORM'.",
      })) {
        result.push(chunk)
      }

      expect(result).toEqual(chunks)
    })
  })
})
