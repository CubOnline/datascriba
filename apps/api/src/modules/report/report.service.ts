import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  renderReport,
  renderTemplate,
  validateParameters,
} from '@datascriba/report-engine'
import type { ExportFormat, ReportDefinition, ReportParameter, RunRecord } from '@datascriba/report-engine'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import { DataSourceService } from '../data-source/data-source.service'

import type { CreateReportDto } from './dto/create-report.dto'
import type { RunReportDto } from './dto/run-report.dto'
import { ReportRepository } from './report.repository'

const DEFAULT_WORKSPACE_ID = 'default'
const DEFAULT_CREATED_BY = 'system'
const OUTPUT_DIR = path.resolve('./output')

type RunResult = {
  buffer: Buffer
  filename: string
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

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name)

  constructor(
    private readonly repository: ReportRepository,
    private readonly dataSourceService: DataSourceService,
  ) {
    this.ensureOutputDir()
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  }

  async create(dto: CreateReportDto): Promise<ReportDefinition> {
    const report = await this.repository.create({
      name: dto.name,
      description: dto.description,
      dataSourceId: dto.dataSourceId,
      query: dto.query,
      parameters: (dto.parameters ?? []) as ReportParameter[],
      exportFormats: dto.exportFormats as ExportFormat[],
      workspaceId: DEFAULT_WORKSPACE_ID,
      createdBy: DEFAULT_CREATED_BY,
    })
    this.logger.log({ reportId: report.id, name: report.name }, 'Report definition created')
    return report
  }

  async findAll(): Promise<ReportDefinition[]> {
    return this.repository.findAll(DEFAULT_WORKSPACE_ID)
  }

  async findOne(id: string): Promise<ReportDefinition> {
    const report = await this.repository.findById(id)
    if (!report) throw new NotFoundException(`Report '${id}' not found`)
    return report
  }

  async update(id: string, dto: Partial<CreateReportDto>): Promise<ReportDefinition> {
    const existing = await this.repository.findById(id)
    if (!existing) throw new NotFoundException(`Report '${id}' not found`)

    const patch: Partial<Omit<ReportDefinition, 'id' | 'workspaceId' | 'createdAt'>> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.description !== undefined) patch.description = dto.description
    if (dto.query !== undefined) patch.query = dto.query
    if (dto.dataSourceId !== undefined) patch.dataSourceId = dto.dataSourceId
    if (dto.exportFormats !== undefined) patch.exportFormats = dto.exportFormats as ExportFormat[]
    if (dto.parameters !== undefined) patch.parameters = dto.parameters as ReportParameter[]

    const updated = await this.repository.update(id, patch)
    if (!updated) throw new NotFoundException(`Report '${id}' not found`)

    this.logger.log({ reportId: id }, 'Report definition updated')
    return updated
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id)
    if (!deleted) throw new NotFoundException(`Report '${id}' not found`)
    this.logger.log({ reportId: id }, 'Report definition deleted')
  }

  async run(id: string, dto: RunReportDto): Promise<RunResult> {
    const report = await this.findOne(id)

    const runId = crypto.randomUUID()
    const now = new Date()

    const pendingRun: RunRecord = {
      id: runId,
      reportId: id,
      status: 'running',
      format: dto.format,
      parameters: dto.parameters ?? {},
      startedAt: now,
    }
    await this.repository.createRun(pendingRun)

    try {
      // Validate parameters
      let resolvedParams: Record<string, unknown> = {}
      if (report.parameters.length > 0) {
        resolvedParams = validateParameters(report.parameters, dto.parameters ?? {})
      }

      // Render SQL template (structural composition only — values go as params)
      const sql = renderTemplate(report.query, resolvedParams)

      // Execute query against the data source
      const queryResult = await this.dataSourceService.executeQuery(report.dataSourceId, sql, [])

      // Build ReportData
      const reportData = {
        columns: queryResult.columns,
        rows: queryResult.rows,
        parameters: resolvedParams,
        reportName: report.name,
        generatedAt: new Date(),
      }

      // Render to buffer
      const buffer = await renderReport(reportData, { format: dto.format })

      // Write output file — sanitize name to prevent path traversal
      const ext = FILE_EXTENSIONS[dto.format]
      const safeName = report.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
      const filename = `${safeName}-${runId}.${ext}`
      const outputPath = path.join(OUTPUT_DIR, filename)
      if (!outputPath.startsWith(OUTPUT_DIR + path.sep)) {
        throw new Error('Invalid output path detected')
      }
      fs.writeFileSync(outputPath, buffer)

      // Update run record
      await this.repository.updateRun(runId, {
        status: 'completed',
        completedAt: new Date(),
        outputPath,
      })

      this.logger.log(
        { reportId: id, runId, format: dto.format, rows: queryResult.rowCount },
        'Report run completed',
      )

      return {
        buffer,
        filename,
        mimeType: MIME_TYPES[dto.format],
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await this.repository.updateRun(runId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      })
      this.logger.error({ reportId: id, runId, err }, 'Report run failed')

      throw err
    }
  }

  async listRuns(reportId: string): Promise<RunRecord[]> {
    const report = await this.repository.findById(reportId)
    if (!report) throw new NotFoundException(`Report '${reportId}' not found`)
    return this.repository.findRunsByReportId(reportId)
  }

  async findRun(reportId: string, runId: string): Promise<RunRecord> {
    const report = await this.repository.findById(reportId)
    if (!report) throw new NotFoundException(`Report '${reportId}' not found`)
    const run = await this.repository.findRunById(runId)
    if (!run || run.reportId !== reportId) {
      throw new NotFoundException(`Run '${runId}' not found for report '${reportId}'`)
    }
    return run
  }
}
