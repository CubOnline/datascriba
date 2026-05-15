import Anthropic from '@anthropic-ai/sdk'

import {
  buildExplainQueryUserMessage,
  EXPLAIN_QUERY_SYSTEM_PROMPT,
} from './prompts/explain-query'
import {
  buildFixQueryUserMessage,
  FIX_QUERY_SYSTEM_PROMPT,
} from './prompts/fix-query'
import {
  buildSuggestQueryUserMessage,
  SUGGEST_QUERY_SYSTEM_PROMPT,
} from './prompts/suggest-query'
import type {
  AiClientConfig,
  AiStreamChunk,
  AiTextResponse,
  ExplainQueryRequest,
  FixQueryRequest,
  SuggestQueryRequest,
} from './types'

const DEFAULT_MAX_TOKENS = 2048

/**
 * Anthropic SDK wrapper.
 * Prompt caching etkin: sistem promptları `cache_control: { type: 'ephemeral' }` ile cache'lenir.
 * Ephemeral cache TTL: 5 dakika (Anthropic default).
 */
export class AiClient {
  private readonly client: Anthropic
  private readonly model: string
  private readonly maxTokens: number

  constructor(config: AiClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
  }

  /**
   * Kullanıcının doğal dil isteğine göre SQL sorgusu önerir.
   * Streaming — her chunk AsyncIterable<AiStreamChunk> ile döner.
   */
  async *suggestQuery(req: SuggestQueryRequest): AsyncIterable<AiStreamChunk> {
    const userContent = buildSuggestQueryUserMessage(req.prompt, req.schemaContext)

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: SUGGEST_QUERY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', text: event.delta.text }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI stream error'
      yield { type: 'error', error: message }
      return
    }

    yield { type: 'done' }
  }

  /**
   * SQL sorgusunu Türkçe ve İngilizce olarak açıklar.
   * Tek seferlik (non-streaming) yanıt döner.
   */
  async explainQuery(req: ExplainQueryRequest): Promise<AiTextResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: EXPLAIN_QUERY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildExplainQueryUserMessage(req.sql),
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock?.type === 'text' ? textBlock.text : ''

    const usage = response.usage as Anthropic.Usage & {
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }

    return {
      text,
      model: response.model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    }
  }

  /**
   * Hatalı SQL'i hata mesajıyla birlikte düzeltir.
   * Streaming — her chunk AsyncIterable<AiStreamChunk> ile döner.
   */
  async *fixQuery(req: FixQueryRequest): AsyncIterable<AiStreamChunk> {
    const userContent = buildFixQueryUserMessage(req.sql, req.errorMessage)

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [
        {
          type: 'text',
          text: FIX_QUERY_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', text: event.delta.text }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI stream error'
      yield { type: 'error', error: message }
      return
    }

    yield { type: 'done' }
  }
}
