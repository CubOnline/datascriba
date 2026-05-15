'use client'

import type {
  AiSseChunk,
  ExplainQueryBody,
  ExplainQueryResponse,
  FixQueryBody,
  SuggestQueryBody,
} from '@datascriba/shared-types'
import { useCallback, useState } from 'react'

import { env } from '@/lib/env'

interface StreamState {
  text: string
  isStreaming: boolean
  error: string | null
}

const INITIAL_STREAM_STATE: StreamState = {
  text: '',
  isStreaming: false,
  error: null,
}

/**
 * SSE stream okuyan generic yardımcı.
 * `onChunk` her delta'da, `onDone` tamamlanınca çağrılır.
 */
async function readSseStream(
  url: string,
  body: unknown,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_URL}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    })
  } catch {
    onError('Network error. Please check your connection.')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    onError(`API error ${response.status}: ${text}`)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    onError('Response body is not readable.')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Son satır incomplete olabilir — buffer'a geri al
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw) continue

        let chunk: AiSseChunk
        try {
          chunk = JSON.parse(raw) as AiSseChunk
        } catch {
          continue
        }

        if (chunk.type === 'delta' && chunk.text) {
          onChunk(chunk.text)
        } else if (chunk.type === 'done') {
          onDone()
        } else if (chunk.type === 'error') {
          onError(chunk.error ?? 'Unknown stream error')
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Doğal dil -> SQL öneri hook'u.
 * Streaming SSE ile karakter karakter gösterim.
 */
export function useSuggestQuery(): {
  suggest: (body: SuggestQueryBody) => Promise<void>
  state: StreamState
  reset: () => void
} {
  const [state, setState] = useState<StreamState>(INITIAL_STREAM_STATE)

  const reset = useCallback(() => setState(INITIAL_STREAM_STATE), [])

  const suggest = useCallback(async (body: SuggestQueryBody): Promise<void> => {
    setState({ text: '', isStreaming: true, error: null })

    await readSseStream(
      '/api/v1/ai/suggest-query',
      body,
      (chunk) => setState((prev) => ({ ...prev, text: prev.text + chunk })),
      () => setState((prev) => ({ ...prev, isStreaming: false })),
      (err) => setState({ text: '', isStreaming: false, error: err }),
    )
  }, [])

  return { suggest, state, reset }
}

/**
 * SQL açıklama hook'u.
 * Non-streaming, tek seferlik yanıt.
 */
export function useExplainQuery(): {
  explain: (body: ExplainQueryBody) => Promise<void>
  response: ExplainQueryResponse | null
  isLoading: boolean
  error: string | null
  reset: () => void
} {
  const [response, setResponse] = useState<ExplainQueryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  const explain = useCallback(async (body: ExplainQueryBody): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/api/v1/ai/explain-query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error')
        setError(`API error ${res.status}: ${text}`)
        return
      }
      const data = (await res.json()) as ExplainQueryResponse
      setResponse(data)
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { explain, response, isLoading, error, reset }
}

/**
 * SQL düzeltme hook'u.
 * Streaming SSE ile karakter karakter gösterim.
 */
export function useFixQuery(): {
  fix: (body: FixQueryBody) => Promise<void>
  state: StreamState
  reset: () => void
} {
  const [state, setState] = useState<StreamState>(INITIAL_STREAM_STATE)

  const reset = useCallback(() => setState(INITIAL_STREAM_STATE), [])

  const fix = useCallback(async (body: FixQueryBody): Promise<void> => {
    setState({ text: '', isStreaming: true, error: null })

    await readSseStream(
      '/api/v1/ai/fix-query',
      body,
      (chunk) => setState((prev) => ({ ...prev, text: prev.text + chunk })),
      () => setState((prev) => ({ ...prev, isStreaming: false })),
      (err) => setState({ text: '', isStreaming: false, error: err }),
    )
  }, [])

  return { fix, state, reset }
}
