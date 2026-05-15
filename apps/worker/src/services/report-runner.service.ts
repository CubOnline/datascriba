import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  renderReport,
  renderTemplate,
  validateParameters,
} from '@datascriba/report-engine'
import type { ExportFormat, ReportDefinition } from '@datascriba/report-engine'
import type { RunReportJobPayload } from '@datascriba/queue-config'
import type { WorkerEnv } from '../config/worker-env'

interface RunOutput {
  buffer: Buffer
  filename: string
  reportName: string
  mimeType: string
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  excel: 'xlsx',
}

const OUTPUT_DIR = path.resolve('./output')

@Injectable()
export class ReportRunnerService {
  private readonly logger = new Logger(ReportRunnerService.name)

  constructor(private readonly config: ConfigService<WorkerEnv, true>) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  }

  /**
   * Fetches report definition from the API service, executes the query,
   * renders the output file, and returns the result buffer.
   *
   * Strategy: Worker calls INTERNAL_API_URL to get the ReportDefinition.
   * This avoids duplicating the report store in the worker process.
   * When Prisma is introduced (future phase), both API and Worker can
   * share the same DB connection instead.
   */
  async run(payload: RunReportJobPayload): Promise<RunOutput> {
    const apiUrl = this.config.get('INTERNAL_API_URL', { infer: true })

    // 1. Fetch report definition
    const reportRes = await fetch(`${apiUrl}/reports/${payload.reportId}`)
    if (!reportRes.ok) {
      throw new Error(
        `Failed to fetch report '${payload.reportId}': ${reportRes.status} ${reportRes.statusText}`,
      )
    }
    // The fetch result shape is verified by the API — trust internal call
    const report = (await reportRes.json()) as ReportDefinition

    // 2. Validate parameters
    let resolvedParams: Record<string, unknown> = {}
    if (report.parameters.length > 0) {
      resolvedParams = validateParameters(report.parameters, payload.parameters)
    }

    // 3. Render SQL template
    const sql = renderTemplate(report.query, resolvedParams)

    // 4. Execute query via internal API run endpoint (no direct DB access in worker)
    // Worker delegates query execution back to the API's /reports/:id/run endpoint.
    // This keeps MSSQL driver configuration centralized in the API.
    const runRes = await fetch(`${apiUrl}/reports/${payload.reportId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/octet-stream' },
      body: JSON.stringify({ format: payload.format, parameters: payload.parameters }),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      throw new Error(`Report run failed: ${runRes.status} — ${errText}`)
    }

    const arrayBuffer = await runRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = FILE_EXTENSIONS[payload.format]
    const safeName = report.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
    const runId = crypto.randomUUID()
    const filename = `${safeName}-${runId}.${ext}`
    const outputPath = path.join(OUTPUT_DIR, filename)

    if (!outputPath.startsWith(OUTPUT_DIR + path.sep)) {
      throw new Error('Invalid output path detected')
    }

    fs.writeFileSync(outputPath, buffer)

    this.logger.log({ reportId: payload.reportId, filename }, 'Report file written by worker')

    // suppress unused import warnings — sql is computed for validation purposes
    void sql

    return {
      buffer,
      filename,
      reportName: report.name,
      mimeType: MIME_TYPES[payload.format],
    }
  }
}
