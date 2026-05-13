import type { ColumnMeta, Row } from '@datascriba/shared-types'

export type ExportFormat = 'csv' | 'excel'

export interface ReportData {
  columns: ColumnMeta[]
  rows: Row[]
  parameters: Record<string, unknown>
  reportName: string
  generatedAt: Date
}

export interface RenderOptions {
  format: ExportFormat
  filename?: string
}

export interface ReportRenderer {
  readonly format: ExportFormat
  render(data: ReportData, options: RenderOptions): Promise<Buffer>
}

export type ReportParameterType =
  | 'string'
  | 'number'
  | 'date'
  | 'dateRange'
  | 'select'
  | 'multiSelect'
  | 'boolean'

export interface ReportParameter {
  name: string
  type: ReportParameterType
  label: string
  required: boolean
  defaultValue?: unknown
  options?: { label: string; value: unknown }[]
  dependsOn?: string[]
}

export interface ReportDefinition {
  id: string
  workspaceId: string
  name: string
  description?: string
  dataSourceId: string
  query: string
  parameters: ReportParameter[]
  exportFormats: ExportFormat[]
  version: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface RunRecord {
  id: string
  reportId: string
  status: RunStatus
  format: ExportFormat
  parameters: Record<string, unknown>
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  outputPath?: string
}
