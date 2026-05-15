/**
 * AI HTTP endpoint request/response tipleri.
 * Frontend ve backend tarafından import edilir.
 */

/** POST /ai/suggest-query request body */
export interface SuggestQueryBody {
  prompt: string
  dataSourceId: string
}

/** POST /ai/explain-query request body */
export interface ExplainQueryBody {
  sql: string
}

/** POST /ai/fix-query request body */
export interface FixQueryBody {
  sql: string
  errorMessage: string
}

/**
 * explain-query endpoint yanıtı (non-streaming).
 * Türkçe ve İngilizce bölümleri ayrıştırılmış halde döner.
 */
export interface ExplainQueryResponse {
  turkish: string
  english: string
  model: string
}

/**
 * Streaming SSE event data tipi.
 * suggest-query ve fix-query endpoint'leri bu formatı kullanır.
 * Her SSE satırı: `data: <JSON>\n\n`
 */
export interface AiSseChunk {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
}
