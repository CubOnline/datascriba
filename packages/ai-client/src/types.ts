import type { ColumnMeta, TableMeta } from '@datascriba/shared-types'

/**
 * Veri kaynağı şema özeti — AI prompt'larına gönderilir.
 * Sadece AI'ın ihtiyacı olan meta bilgiyi içerir.
 */
export interface SchemaContext {
  dataSourceId: string
  tables: Array<{
    schema: string
    name: string
    type: TableMeta['type']
    columns: ColumnMeta[]
  }>
}

/**
 * SQL öneri isteği payload'u.
 */
export interface SuggestQueryRequest {
  prompt: string
  dataSourceId: string
  schemaContext: SchemaContext
}

/**
 * SQL açıklama isteği payload'u.
 */
export interface ExplainQueryRequest {
  sql: string
}

/**
 * SQL düzeltme isteği payload'u.
 */
export interface FixQueryRequest {
  sql: string
  errorMessage: string
}

/**
 * Streaming olmayan (tek seferlik) AI yanıtı.
 */
export interface AiTextResponse {
  text: string
  /** Anthropic model ID */
  model: string
  /** Input token sayısı (cache hit dahil) */
  inputTokens: number
  /** Output token sayısı */
  outputTokens: number
  /** Cache'e yazılan token sayısı (varsa) */
  cacheCreationInputTokens: number
  /** Cache'ten okunan token sayısı (varsa) */
  cacheReadInputTokens: number
}

/**
 * Streaming SSE chunk — frontend bu formatı bekler.
 */
export interface AiStreamChunk {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}

/**
 * AiClient konfigürasyonu.
 */
export interface AiClientConfig {
  apiKey: string
  model: string
  maxTokens?: number
}
