import { describe, it, expect } from 'vitest'
import { RunReportJobSchema } from './run-report-job.schema'

describe('RunReportJobSchema', () => {
  it('validates a correct payload', () => {
    const payload = {
      scheduleId: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      format: 'csv',
      parameters: { month: '2026-01' },
      notifyEmail: 'user@example.com',
      triggeredBy: 'scheduler',
      triggeredAt: new Date().toISOString(),
    }
    expect(RunReportJobSchema.parse(payload)).toMatchObject({ format: 'csv' })
  })

  it('rejects invalid format', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: crypto.randomUUID(),
        reportId: crypto.randomUUID(),
        format: 'pdf',
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: crypto.randomUUID(),
        reportId: crypto.randomUUID(),
        format: 'excel',
        notifyEmail: 'not-an-email',
        triggeredBy: 'scheduler',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })

  it('defaults parameters to empty object', () => {
    const result = RunReportJobSchema.parse({
      scheduleId: crypto.randomUUID(),
      reportId: crypto.randomUUID(),
      format: 'excel',
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    })
    expect(result.parameters).toEqual({})
  })

  it('rejects non-UUID scheduleId', () => {
    expect(() =>
      RunReportJobSchema.parse({
        scheduleId: 'not-a-uuid',
        reportId: crypto.randomUUID(),
        format: 'csv',
        triggeredBy: 'manual',
        triggeredAt: new Date().toISOString(),
      }),
    ).toThrow()
  })
})
