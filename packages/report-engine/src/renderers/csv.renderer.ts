import Papa from 'papaparse'

import { RenderError } from '../errors'
import type { ExportFormat, ReportData, RenderOptions, ReportRenderer } from '../types'

export class CsvRenderer implements ReportRenderer {
  readonly format: ExportFormat = 'csv'

  render(data: ReportData, _options: RenderOptions): Promise<Buffer> {
    try {
      const columnNames = data.columns.map((col) => col.name)

      // Convert rows to plain objects keyed by column name
      const rows = data.rows.map((row) => {
        const obj: Record<string, unknown> = {}
        for (const col of columnNames) {
          obj[col] = row[col] ?? null
        }
        return obj
      })

      const csv = Papa.unparse(
        { fields: columnNames, data: rows },
        { header: true },
      )

      return Promise.resolve(Buffer.from(csv, 'utf-8'))
    } catch (err: unknown) {
      return Promise.reject(
        new RenderError(
          `CSV rendering failed: ${err instanceof Error ? err.message : String(err)}`,
          err,
        ),
      )
    }
  }
}
