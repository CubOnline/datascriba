const DEFAULT_TTL_MS = 5 * 60 * 1_000 // 5 minutes

interface CacheEntry {
  value: unknown
  expiresAt: number
}

/**
 * Generic in-memory TTL cache keyed by string.
 * Phase 6 replaces this with Redis.
 */
export class SchemaCache {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
