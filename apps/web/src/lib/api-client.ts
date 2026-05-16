import { env } from './env'
import { getToken } from './auth'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text)
  }
  if (res.status === 204) return undefined as T
  // res.json() returns Promise<unknown>; cast is intentional — callers are
  // responsible for runtime validation when strict shape guarantees are needed.
  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => apiFetch<T>(path),
  post: <T>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown): Promise<T> =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string): Promise<T> => apiFetch<T>(path, { method: 'DELETE' }),
  postRaw: (path: string, body: unknown): Promise<Response> =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}
