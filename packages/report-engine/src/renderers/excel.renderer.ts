import ExcelJS from 'exceljs'

import { RenderError } from '../errors'
import type { ExportFormat, ReportData, RenderOptions, ReportRenderer } from '../types'

const MAX_SHEET_NAME_LENGTH = 31
const HEADER_FILL_COLOR = 'FFCCCCCC'
const MIN_COLUMN_PADDING = 4

export class ExcelRenderer implements ReportRenderer {
  readonly format: ExportFormat = 'excel'

  async render(data: ReportData, _options: RenderOptions): Promise<Buffer> {
    try {
      const workbook = new ExcelJS.Workbook()

      const sheetName = data.reportName.slice(0, MAX_SHEET_NAME_LENGTH)
      const worksheet = workbook.addWorksheet(sheetName)

      // Freeze first row
      worksheet.views = [{ state: 'frozen', ySplit: 1 }]

      const columnNames = data.columns.map((col) => col.name)

      // Set column definitions with auto-width based on header name
      worksheet.columns = columnNames.map((name) => ({
        header: name,
        key: name,
        width: name.length + MIN_COLUMN_PADDING,
      }))

      // Style the header row (row 1)
      const headerRow = worksheet.getRow(1)
      headerRow.eachCell((cell) => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: HEADER_FILL_COLOR },
        }
      })
      headerRow.commit()

      // Add data rows
      for (const row of data.rows) {
        const rowValues: Record<string, unknown> = {}
        for (const col of columnNames) {
          rowValues[col] = row[col] ?? null
        }
        worksheet.addRow(rowValues).commit()
      }

      const buffer = await workbook.xlsx.writeBuffer()
      return Buffer.from(buffer)
    } catch (err: unknown) {
      throw new RenderError(
        `Excel rendering failed: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }
}
