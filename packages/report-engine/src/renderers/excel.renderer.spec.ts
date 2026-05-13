import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import type { ReportData, RenderOptions } from '../types'

import { ExcelRenderer } from './excel.renderer'

const sampleData: ReportData = {
  reportName: 'Sales Report',
  generatedAt: new Date('2026-01-01T00:00:00Z'),
  parameters: {},
  columns: [
    { name: 'id', dataType: 'int', nullable: false, isPrimaryKey: true, defaultValue: null },
    { name: 'product', dataType: 'varchar', nullable: true, isPrimaryKey: false, defaultValue: null },
    { name: 'revenue', dataType: 'decimal', nullable: true, isPrimaryKey: false, defaultValue: null },
  ],
  rows: [
    { id: 1, product: 'Widget A', revenue: 500.0 },
    { id: 2, product: 'Widget B', revenue: 750.25 },
  ],
}

const sampleOptions: RenderOptions = { format: 'excel' }

describe('ExcelRenderer', () => {
  const renderer = new ExcelRenderer()

  it('has format = excel', () => {
    expect(renderer.format).toBe('excel')
  })

  it('returns a non-empty Buffer', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('starts with PK magic bytes (XLSX is a ZIP)', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    // ZIP magic bytes: 0x50 0x4B (PK)
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
  })

  it('header row is bold', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet).toBeDefined()
    const headerRow = sheet!.getRow(1)
    headerRow.eachCell((cell) => {
      expect(cell.font?.bold).toBe(true)
    })
  })

  it('first row is frozen', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet).toBeDefined()
    const views = sheet!.views
    expect(views.length).toBeGreaterThan(0)
    const view = views[0]
    expect(view?.state).toBe('frozen')
    expect(view?.ySplit).toBe(1)
  })

  it('data rows contain correct values', async () => {
    const buffer = await renderer.render(sampleData, sampleOptions)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet).toBeDefined()

    // Row 2 = first data row (row 1 is header)
    const row2 = sheet!.getRow(2)
    const idCell = row2.getCell(1)
    expect(idCell.value).toBe(1)

    const row3 = sheet!.getRow(3)
    const productCell = row3.getCell(2)
    expect(productCell.value).toBe('Widget B')
  })

  it('sheet name is derived from reportName (max 31 chars)', async () => {
    const longNameData: ReportData = {
      ...sampleData,
      reportName: 'This Report Name Is Way Too Long For Excel Sheet Names',
    }
    const buffer = await renderer.render(longNameData, sampleOptions)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet).toBeDefined()
    expect(sheet!.name.length).toBeLessThanOrEqual(31)
  })
})
