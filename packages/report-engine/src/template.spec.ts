import { describe, expect, it } from 'vitest'

import { TemplateError } from './errors'
import { compileTemplate, renderTemplate } from './template'

describe('renderTemplate', () => {
  it('renders a simple variable substitution', () => {
    const result = renderTemplate('SELECT * FROM {{tableName}}', { tableName: 'orders' })
    expect(result).toBe('SELECT * FROM orders')
  })

  it('renders ifEq helper — condition true includes block', () => {
    const query = 'SELECT * FROM t {{#ifEq status "active"}}WHERE active = 1{{/ifEq}}'
    const result = renderTemplate(query, { status: 'active' })
    expect(result).toContain('WHERE active = 1')
  })

  it('renders ifEq helper — condition false excludes block', () => {
    const query = 'SELECT * FROM t {{#ifEq status "active"}}WHERE active = 1{{/ifEq}}'
    const result = renderTemplate(query, { status: 'inactive' })
    expect(result).not.toContain('WHERE active = 1')
  })

  it('renders with multiple parameters', () => {
    const result = renderTemplate(
      'SELECT TOP {{limit}} * FROM {{schema}}.{{table}}',
      { limit: 100, schema: 'dbo', table: 'Sales' },
    )
    expect(result).toBe('SELECT TOP 100 * FROM dbo.Sales')
  })

  // Handlebars reports parse errors at render time (lazy parsing) — this
  // goes through renderTemplate which catches and re-wraps as TemplateError.
  it('throws TemplateError on invalid Handlebars syntax', () => {
    // '{{ bad syntax !!}}' causes a parse error during render
    expect(() => renderTemplate('{{ bad syntax !!}}', {})).toThrow(TemplateError)
  })
})

describe('compileTemplate', () => {
  it('returns a callable template function', () => {
    const fn = compileTemplate('Hello {{name}}')
    expect(typeof fn).toBe('function')
    expect(fn({ name: 'World' })).toBe('Hello World')
  })

  // Handlebars uses lazy parsing: most syntax errors surface only at render time.
  // compileTemplate wraps render-time errors from the compiled template delegate.
  // Verify it works correctly by compiling a valid template.
  it('compiles valid syntax without throwing', () => {
    expect(() => compileTemplate('SELECT {{col}} FROM {{table}}')).not.toThrow()
  })
})

describe('formatDate helper', () => {
  it('formats a date string to YYYY-MM-DD by default', () => {
    const result = renderTemplate('{{formatDate reportDate "YYYY-MM-DD"}}', {
      reportDate: '2026-05-13T10:30:00Z',
    })
    expect(result).toBe('2026-05-13')
  })

  it('formats a Date object to YYYY-MM-DD', () => {
    const result = renderTemplate('{{formatDate reportDate "YYYY-MM-DD"}}', {
      reportDate: new Date('2026-03-15T00:00:00Z'),
    })
    expect(result).toMatch(/2026-03-15/)
  })
})
