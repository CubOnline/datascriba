import { describe, it, expect } from 'vitest'

import { QueryBlockedError } from './errors'
import { assertParameterized, assertQueryAllowed } from './query-guard'

describe('assertQueryAllowed', () => {
  it('allows a plain SELECT', () => {
    expect(() => assertQueryAllowed('SELECT id, name FROM users WHERE id = @p1')).not.toThrow()
  })

  it('allows INSERT', () => {
    expect(() => assertQueryAllowed('INSERT INTO logs (msg) VALUES (@p1)')).not.toThrow()
  })

  it('allows UPDATE', () => {
    expect(() => assertQueryAllowed('UPDATE users SET name = @p1 WHERE id = @p2')).not.toThrow()
  })

  it('blocks DROP TABLE', () => {
    expect(() => assertQueryAllowed('DROP TABLE users')).toThrow(QueryBlockedError)
  })

  it('blocks TRUNCATE', () => {
    expect(() => assertQueryAllowed('TRUNCATE TABLE orders')).toThrow(QueryBlockedError)
  })

  it('blocks DELETE FROM', () => {
    expect(() => assertQueryAllowed('DELETE FROM sessions')).toThrow(QueryBlockedError)
  })

  it('blocks SQL injection attempt via semicolon', () => {
    expect(() =>
      assertQueryAllowed("SELECT * FROM users WHERE id = 1; DROP TABLE users"),
    ).toThrow(QueryBlockedError)
  })
})

describe('assertParameterized', () => {
  it('passes when params match placeholders', () => {
    expect(() => assertParameterized('SELECT * FROM t WHERE id = @p1', [42])).not.toThrow()
  })

  it('passes when no params and no placeholders', () => {
    expect(() => assertParameterized('SELECT 1', [])).not.toThrow()
  })

  it('blocks raw string concatenation pattern', () => {
    // SQL string containing the literal concat pattern ' + ' (single-quote + plus + single-quote)
    const sqlWithConcat = "SELECT * FROM t WHERE name = 'a' + 'b'"
    expect(() => assertParameterized(sqlWithConcat, [])).toThrow(QueryBlockedError)
  })
})
