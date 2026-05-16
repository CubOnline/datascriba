import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
}))

import { useExplainQuery, useFixQuery, useSuggestQuery } from './use-ai'

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function makeJsonChunk(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

describe('useSuggestQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with empty text and not streaming', () => {
    const { result } = renderHook(() => useSuggestQuery())
    expect(result.current.state.text).toBe('')
    expect(result.current.state.isStreaming).toBe(false)
    expect(result.current.state.error).toBeNull()
  })

  it('accumulates delta chunks and marks done', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SELECT ' }),
      makeJsonChunk({ type: 'delta', text: '1' }),
      makeJsonChunk({ type: 'done' }),
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    const { result } = renderHook(() => useSuggestQuery())

    act(() => {
      void result.current.suggest({ prompt: 'Show users', dataSourceId: 'ds-1' })
    })

    await waitFor(() => expect(result.current.state.isStreaming).toBe(false))

    expect(result.current.state.text).toBe('SELECT 1')
    expect(result.current.state.error).toBeNull()
  })

  it('sets error when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    expect(result.current.state.error).toMatch(/network/i)
    expect(result.current.state.isStreaming).toBe(false)
  })

  it('sets error on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    )

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    expect(result.current.state.error).toMatch(/401/)
  })

  it('reset clears accumulated text and error', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SQL' }),
      makeJsonChunk({ type: 'done' }),
    ])
    vi.mocked(fetch).mockResolvedValueOnce(new Response(stream, { status: 200 }))

    const { result } = renderHook(() => useSuggestQuery())

    await act(async () => {
      await result.current.suggest({ prompt: 'test', dataSourceId: 'ds-1' })
    })

    act(() => { result.current.reset() })

    expect(result.current.state.text).toBe('')
    expect(result.current.state.error).toBeNull()
  })
})

describe('useExplainQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with null response and not loading', () => {
    const { result } = renderHook(() => useExplainQuery())
    expect(result.current.response).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('fetches explanation and sets response', async () => {
    const payload = { turkish: 'Turkce', english: 'English', model: 'claude-sonnet-4-6' }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useExplainQuery())

    await act(async () => {
      await result.current.explain({ sql: 'SELECT 1' })
    })

    expect(result.current.response?.turkish).toBe('Turkce')
    expect(result.current.response?.english).toBe('English')
    expect(result.current.isLoading).toBe(false)
  })

  it('sets error on API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Server Error', { status: 500 }),
    )

    const { result } = renderHook(() => useExplainQuery())

    await act(async () => {
      await result.current.explain({ sql: 'SELECT 1' })
    })

    expect(result.current.error).toMatch(/500/)
    expect(result.current.response).toBeNull()
  })
})

describe('useFixQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams fixed SQL and sets text', async () => {
    const stream = makeSseStream([
      makeJsonChunk({ type: 'delta', text: 'SELECT * FROM users' }),
      makeJsonChunk({ type: 'done' }),
    ])

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )

    const { result } = renderHook(() => useFixQuery())

    await act(async () => {
      await result.current.fix({ sql: 'SELEC * FROM users', errorMessage: 'syntax error' })
    })

    expect(result.current.state.text).toBe('SELECT * FROM users')
    expect(result.current.state.isStreaming).toBe(false)
  })
})
