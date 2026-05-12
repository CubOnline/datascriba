import { QueryBlockedError } from './errors'

const BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*DROP\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*DELETE\s+FROM\s+/i,
  /;\s*DROP\s+/i,
  /;\s*TRUNCATE\s+/i,
  /;\s*DELETE\s+FROM\s+/i,
]

/**
 * Validates that the SQL statement does not contain blocked operations.
 * Only called when `allowMutations` is false (the default).
 * @throws {QueryBlockedError} if a blocked pattern is matched
 */
export function assertQueryAllowed(sql: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      throw new QueryBlockedError(sql, `matches blocked pattern: ${pattern.toString()}`)
    }
  }
}

/**
 * Validates that params array is provided and SQL uses placeholders.
 * This is a soft guard — drivers always use parameterized queries at the
 * protocol level; this check catches obviously wrong usage at the call site.
 * @throws {QueryBlockedError} if SQL contains raw concat patterns
 */
export function assertParameterized(sql: string, params: unknown[]): void {
  // Detect string concatenation attempts in the SQL itself (not in params)
  const RAW_CONCAT = /'\s*\+\s*'|"\s*\+\s*"/
  if (RAW_CONCAT.test(sql)) {
    throw new QueryBlockedError(sql, 'SQL contains raw string concatenation — use params array')
  }
  // Warn: no placeholders but params provided (mismatch)
  const hasPlaceholders = /\$\d+|\?|@[a-zA-Z_]\w*/.test(sql)
  if (params.length > 0 && !hasPlaceholders) {
    throw new QueryBlockedError(sql, 'params provided but SQL has no placeholders')
  }
}
