import { describe, expect, it } from 'vitest'

import { ParameterValidationError } from './errors'
import { validateParameters } from './parameters'
import type { ReportParameter } from './types'

const stringParam: ReportParameter = {
  name: 'status',
  type: 'string',
  label: 'Status',
  required: true,
}

const numberParam: ReportParameter = {
  name: 'limit',
  type: 'number',
  label: 'Limit',
  required: true,
}

const dateParam: ReportParameter = {
  name: 'startDate',
  type: 'date',
  label: 'Start Date',
  required: true,
}

const dateRangeParam: ReportParameter = {
  name: 'dateRange',
  type: 'dateRange',
  label: 'Date Range',
  required: true,
}

const booleanParam: ReportParameter = {
  name: 'isActive',
  type: 'boolean',
  label: 'Is Active',
  required: true,
}

describe('validateParameters', () => {
  it('passes valid string parameter', () => {
    const result = validateParameters([stringParam], { status: 'active' })
    expect(result['status']).toBe('active')
  })

  it('passes valid number parameter', () => {
    const result = validateParameters([numberParam], { limit: 100 })
    expect(result['limit']).toBe(100)
  })

  it('passes valid boolean parameter', () => {
    const result = validateParameters([booleanParam], { isActive: true })
    expect(result['isActive']).toBe(true)
  })

  it('passes valid dateRange parameter', () => {
    const result = validateParameters([dateRangeParam], {
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
    })
    expect(result['dateRange']).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('throws ParameterValidationError with correct field name for missing required param', () => {
    expect(() => validateParameters([stringParam], {})).toThrow(ParameterValidationError)

    try {
      validateParameters([stringParam], {})
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParameterValidationError)
      expect((err as ParameterValidationError).field).toBe('status')
    }
  })

  it('throws ParameterValidationError for invalid date format', () => {
    expect(() =>
      validateParameters([dateParam], { startDate: 'not-a-date' }),
    ).toThrow(ParameterValidationError)

    try {
      validateParameters([dateParam], { startDate: 'not-a-date' })
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ParameterValidationError)
      expect((err as ParameterValidationError).field).toBe('startDate')
    }
  })

  it('accepts ISO 8601 datetime string for date param', () => {
    const result = validateParameters([dateParam], { startDate: '2026-01-01T00:00:00Z' })
    expect(result['startDate']).toBe('2026-01-01T00:00:00Z')
  })

  it('uses defaultValue when optional param is missing', () => {
    const optionalParam: ReportParameter = {
      name: 'pageSize',
      type: 'number',
      label: 'Page Size',
      required: false,
      defaultValue: 50,
    }
    const result = validateParameters([optionalParam], {})
    expect(result['pageSize']).toBe(50)
  })

  it('skips optional param without default when value is missing', () => {
    const optionalParam: ReportParameter = {
      name: 'filter',
      type: 'string',
      label: 'Filter',
      required: false,
    }
    const result = validateParameters([optionalParam], {})
    expect(result['filter']).toBeUndefined()
  })

  it('validates multiple params in one call', () => {
    const result = validateParameters(
      [stringParam, numberParam, booleanParam],
      { status: 'active', limit: 10, isActive: false },
    )
    expect(result['status']).toBe('active')
    expect(result['limit']).toBe(10)
    expect(result['isActive']).toBe(false)
  })
})
