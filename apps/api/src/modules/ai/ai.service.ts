import { AiClient } from '@datascriba/ai-client'
import type { AiStreamChunk, SchemaContext } from '@datascriba/ai-client'
import type { ExplainQueryResponse } from '@datascriba/shared-types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env'
import { DataSourceService } from '../data-source/data-source.service'

import type { ExplainQueryDto } from './dto/explain-query.dto'
import type { FixQueryDto } from './dto/fix-query.dto'
import type { SuggestQueryDto } from './dto/suggest-query.dto'

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)
  private client!: AiClient

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly dataSourceService: DataSourceService,
  ) {}

  onModuleInit(): void {
    const model: string = this.config.get('AI_MODEL')
    this.client = new AiClient({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
      model,
      maxTokens: 2048,
    })
    this.logger.log(`AiService initialized with model: ${model}`)
  }

  /**
   * Veri kaynağının tam şemasını getirir.
   * Tüm tablolar + her tablonun kolonları — AI prompt context'i için.
   */
  private async buildSchemaContext(dataSourceId: string): Promise<SchemaContext> {
    const tables = await this.dataSourceService.listTables(dataSourceId)
    const tablesWithColumns = await Promise.all(
      tables.map(async (table) => {
        const fullName = `${table.schema}.${table.name}`
        const columns = await this.dataSourceService.describeTable(
          dataSourceId,
          fullName,
        )
        return {
          schema: table.schema,
          name: table.name,
          type: table.type,
          columns,
        }
      }),
    )
    return { dataSourceId, tables: tablesWithColumns }
  }

  /**
   * Doğal dil prompt'tan SQL önerisi üretir.
   * Streaming — AsyncIterable<AiStreamChunk> döner.
   */
  async *suggestQuery(dto: SuggestQueryDto): AsyncIterable<AiStreamChunk> {
    this.logger.log(
      { dataSourceId: dto.dataSourceId },
      'AI suggest-query started',
    )
    const schemaContext = await this.buildSchemaContext(dto.dataSourceId)

    yield* this.client.suggestQuery({
      prompt: dto.prompt,
      dataSourceId: dto.dataSourceId,
      schemaContext,
    })

    this.logger.log(
      { dataSourceId: dto.dataSourceId },
      'AI suggest-query completed',
    )
  }

  /**
   * SQL sorgusunu Türkçe ve İngilizce açıklar.
   * Non-streaming — tam yanıt döner.
   */
  async explainQuery(dto: ExplainQueryDto): Promise<ExplainQueryResponse> {
    this.logger.log('AI explain-query started')
    const result = await this.client.explainQuery({ sql: dto.sql })

    const { turkish, english } = this.parseExplainResponse(result.text)

    this.logger.log(
      {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadInputTokens: result.cacheReadInputTokens,
      },
      'AI explain-query completed',
    )

    return { turkish, english, model: result.model }
  }

  /**
   * Hatalı SQL'i düzeltir.
   * Streaming — AsyncIterable<AiStreamChunk> döner.
   */
  async *fixQuery(dto: FixQueryDto): AsyncIterable<AiStreamChunk> {
    this.logger.log('AI fix-query started')

    yield* this.client.fixQuery({
      sql: dto.sql,
      errorMessage: dto.errorMessage,
    })

    this.logger.log('AI fix-query completed')
  }

  /**
   * explain-query yanıtını ---TR--- / ---EN--- bölümlerine ayırır.
   */
  private parseExplainResponse(text: string): {
    turkish: string
    english: string
  } {
    const trMatch = /---TR---\s*([\s\S]*?)(?=---EN---|$)/i.exec(text)
    const enMatch = /---EN---\s*([\s\S]*?)$/i.exec(text)
    return {
      turkish: trMatch?.[1]?.trim() ?? text,
      english: enMatch?.[1]?.trim() ?? '',
    }
  }
}
