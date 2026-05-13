import { UnsupportedFormatError } from './errors'
import { CsvRenderer } from './renderers/csv.renderer'
import { ExcelRenderer } from './renderers/excel.renderer'
import type { ExportFormat, ReportData, RenderOptions, ReportRenderer } from './types'

// PDF, HTML, and Word renderers are planned for a later phase.
// When implemented, add them here:
//   pdf: new PdfRenderer(),
//   html: new HtmlRenderer(),
//   word: new WordRenderer(),
const renderers: Record<ExportFormat, ReportRenderer> = {
  csv: new CsvRenderer(),
  excel: new ExcelRenderer(),
}

/**
 * Renders a report into the requested export format.
 * Throws UnsupportedFormatError if the format is not yet implemented.
 */
export async function renderReport(
  data: ReportData,
  options: RenderOptions,
): Promise<Buffer> {
  const renderer = renderers[options.format]
  if (!renderer) throw new UnsupportedFormatError(options.format)
  return renderer.render(data, options)
}
