import { describe, expect, it } from 'vitest'

import type { ReportData, RenderOptions } from '../types'

import { CsvRenderer } from './csv.renderer'

const sampleData: ReportData = {
  reportName: 'Test Report',
  generatedAt: new Date('2026-01-01T00:00:00Z'),
  parameters: {},
  columns: [
    { name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
    { name: 'name', dataType: 'varchar', nullable: true, isPrimaryKey: false, defaultValue: null },
    { name: 'amount', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { id: 1, name: 'Alice', amount: 100.5 },
    { id: 2, name: 'Bob', amount: 200.75 },
  ],
}

const sampleOptions: RenderOptions = { format: 'csv' }

describe('CsvRenderer', () => {
  const renderer = new CsvRenderer()

  it('has format = csv', () => {
    expect(renderer.format).toBe('csv')
  })

  it('returns a non-empty Buffer', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('contains header row with all column names', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const csv = buffer.toString('utf-8')
    const firstLine = csv.split('\n')[0] ?? ''
    expect(firstLine).toContain('id')
    expect(firstLine).toContain('name')
    expect(firstLine).toContain('amount')
  })

  it('contains data values from rows', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const csv = buffer.toString('utf-8')
    expect(csv).toContain('Alice')
    expect(csv).toContain('Bob')
    expect(csv).toContain('100.5')
    expect(csv).toContain('200.75')
  })

  it('has correct line count: header + 2 data rows = 3 non-empty lines', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const csv = buffer.toString('utf-8')
    const nonEmptyLines = csv.split('\n').filter((line) => line.trim().length > 0)
    expect(nonEmptyLines).toHaveLength(3)
  })

  it('handles empty rows gracefully', async () => {
    const emptyData: ReportData = { ...sampleData, rows: [] }
    const buffer = await renderer.render(emptyData, sampleOptions)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // Should still have header row
    const csv = buffer.toString('utf-8')
    expect(csv).toContain('id')
  })
})
